use id3::{Tag, TagLike};
use std::path::Path;
use lofty::file::AudioFile;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri::Emitter;


#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Track {
    id: String,
    name: String,
    artist: String,
    album: String,
    duration: f64,
    size: u64,
    #[serde(rename = "coverUrl")]
    cover_url: Option<String>,
    lyrics: Option<String>,
    path: String,
    #[serde(rename = "metadataLoaded")]
    metadata_loaded: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FolderNode {
    name: String,
    path: String,
    subfolders: Vec<FolderNode>,
    tracks: Vec<Track>,
}

#[derive(serde::Serialize)]
pub struct ParsedMetadata {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    #[serde(rename = "coverUrl")]
    cover_url: Option<String>,
    lyrics: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct Mp3Tags {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    #[serde(rename = "unsyncedLyrics")]
    unsynced_lyrics: Option<String>,
    #[serde(rename = "coverImageBase64")]
    cover_image_base64: Option<String>,
    #[serde(rename = "coverImageMime")]
    cover_image_mime: Option<String>,
}

fn read_duration(path: &Path) -> Result<f64, lofty::error::LoftyError> {
    let tagged_file = lofty::probe::Probe::open(path)?
        .guess_file_type()?
        .read()?;
    Ok(tagged_file.properties().duration().as_secs_f64())
}

fn scan_dir_recursive(path: &Path) -> Option<FolderNode> {
    let folder_name = path.file_name()?.to_string_lossy().to_string();
    let folder_path = path.to_string_lossy().to_string();

    let mut subfolders = Vec::new();
    let mut tracks = Vec::new();

    let entries = std::fs::read_dir(path).ok()?;
    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(file_type) = entry.file_type() {
                let entry_path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                let lower_name = name.to_lowercase();

                if file_type.is_dir() {
                    // Exclusions to prevent scan hangs in huge system/developer directories
                    if lower_name.starts_with('.')
                        || lower_name == "node_modules"
                        || lower_name == "appdata"
                        || lower_name == "windows"
                        || lower_name == "program files"
                        || lower_name == "program files (x86)"
                        || lower_name == "system volume information"
                        || lower_name == "$recycle.bin"
                        || lower_name == "dist"
                        || lower_name == "build"
                        || lower_name == "out"
                        || lower_name == "target"
                        || lower_name == "bin"
                        || lower_name == "obj"
                        || lower_name == "venv"
                        || lower_name == ".venv"
                        || lower_name == "env"
                        || lower_name == ".env"
                        || lower_name == "__pycache__"
                        || lower_name == "bower_components"
                        || lower_name == "packages"
                        || lower_name == "temp"
                        || lower_name == "tmp"
                        || lower_name == "cache"
                        || lower_name == ".cache"
                        || lower_name == "logs"
                        || lower_name == "log"
                        || lower_name == "ios"
                        || lower_name == "android"
                        || lower_name == "cmake-build-debug"
                        || lower_name == "cmake-build-release"
                        || lower_name == "debug"
                        || lower_name == "release"
                    {
                        continue;
                    }

                    if let Some(sub_node) = scan_dir_recursive(&entry_path) {
                        if !sub_node.tracks.is_empty() || !sub_node.subfolders.is_empty() {
                            subfolders.push(sub_node);
                        }
                    }
                } else if file_type.is_file() {
                    let ext = entry_path.extension().map(|e| e.to_string_lossy().to_string().to_lowercase()).unwrap_or_default();
                    let supported = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
                    if supported.contains(&ext.as_str()) {
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        let clean_name = entry_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or(name.clone()).replace(['_', '-'], " ");

                        let duration = read_duration(&entry_path).unwrap_or(0.0);

                        let track = Track {
                            id: entry_path.to_string_lossy().to_string(),
                            name: clean_name,
                            artist: "Unknown Artist".to_string(),
                            album: "Unknown Album".to_string(),
                            duration,
                            size,
                            cover_url: None,
                            lyrics: None,
                            path: entry_path.to_string_lossy().to_string(),
                            metadata_loaded: false,
                        };
                        tracks.push(track);
                    }
                }
            }
        }
    }

    tracks.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    subfolders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Some(FolderNode {
        name: folder_name,
        path: folder_path,
        subfolders,
        tracks,
    })
}

#[tauri::command]
fn scan_directory_native(dir_path: String) -> Result<FolderNode, String> {
    let path = Path::new(&dir_path);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    scan_dir_recursive(path).ok_or_else(|| "Failed to scan directory".to_string())
}

#[tauri::command]
fn read_lrc_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if let Some(stem) = path.file_stem() {
        let parent = path.parent().unwrap_or(path);
        let lrc_path = parent.join(format!("{}.lrc", stem.to_string_lossy()));
        if lrc_path.exists() {
            std::fs::read_to_string(lrc_path).map_err(|e| e.to_string())
        } else {
            Err("LRC file not found".to_string())
        }
    } else {
        Err("Invalid file path".to_string())
    }
}

#[tauri::command]
fn show_item_in_folder(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        Err("Unsupported operating system".to_string())
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
        Err("Unsupported operating system".to_string())
    }
}

#[tauri::command]
fn parse_metadata_native(file_path: String) -> Result<ParsedMetadata, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let tag = Tag::read_from_path(path).ok();
    
    let mut title = None;
    let mut artist = None;
    let mut album = None;
    let mut cover_url = None;
    let mut lyrics = None;

    if let Some(tag) = tag {
        title = tag.title().map(|s| s.to_string());
        artist = tag.artist().map(|s| s.to_string());
        album = tag.album().map(|s| s.to_string());
        lyrics = tag.lyrics().next().map(|l| l.text.clone());
        
        if let Some(picture) = tag.pictures().next() {
            use base64::engine::general_purpose::STANDARD;
            use base64::Engine;
            let base64_data = STANDARD.encode(&picture.data);
            cover_url = Some(format!("data:{};base64,{}", picture.mime_type, base64_data));
        }
    }

    Ok(ParsedMetadata {
        title,
        artist,
        album,
        cover_url,
        lyrics,
    })
}

#[tauri::command]
fn write_mp3_tags(file_path: String, tags: Mp3Tags) -> Result<bool, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let mut tag = Tag::read_from_path(path).unwrap_or_else(|_| Tag::new());

    if let Some(title) = tags.title {
        tag.set_title(title);
    }
    if let Some(artist) = tags.artist {
        tag.set_artist(artist);
    }
    if let Some(album) = tags.album {
        tag.set_album(album);
    }
    if let Some(lyrics) = tags.unsynced_lyrics {
        tag.remove_all_lyrics();
        tag.add_frame(id3::Frame::with_content(
            "USLT",
            id3::frame::Content::Lyrics(id3::frame::Lyrics {
                lang: "eng".to_string(),
                description: "".to_string(),
                text: lyrics,
            }),
        ));
    }
    if let Some(cover_base64) = tags.cover_image_base64 {
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        if let Ok(img_bytes) = STANDARD.decode(&cover_base64) {
            tag.remove_all_pictures();
            tag.add_frame(id3::frame::Picture {
                mime_type: tags.cover_image_mime.unwrap_or_else(|| "image/jpeg".to_string()),
                picture_type: id3::frame::PictureType::CoverFront,
                description: "Front Cover".to_string(),
                data: img_bytes,
            });
        }
    }

    tag.write_to_path(path, id3::Version::Id3v24)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn trash_file(file_path: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{}', 'OnlyErrorDialogs', 'SendToRecycleBin')",
            file_path.replace('\'', "''")
        );
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map(|output| output.status.success())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::fs::remove_file(file_path).map(|_| true).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<bool, String> {
    std::fs::rename(old_path, new_path).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_file(src_path: String, dest_path: String) -> Result<bool, String> {
    std::fs::copy(src_path, dest_path).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_file(src_path: String, dest_path: String) -> Result<bool, String> {
    if std::fs::rename(&src_path, &dest_path).is_ok() {
        return Ok(true);
    }
    std::fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
    trash_file(src_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create tray menu items
            let play_pause_i = MenuItemBuilder::with_id("play-pause", "נגן / השהה (Play / Pause)").build(app)?;
            let next_i = MenuItemBuilder::with_id("next", "השיר הבא (Next Track)").build(app)?;
            let prev_i = MenuItemBuilder::with_id("prev", "השיר הקודם (Previous Track)").build(app)?;
            let show_i = MenuItemBuilder::with_id("show", "הצג נגן (Show Player)").build(app)?;
            let quit_i = MenuItemBuilder::with_id("quit", "יציאה (Quit)").build(app)?;
            
            let menu = MenuBuilder::new(app)
                .items(&[
                    &play_pause_i,
                    &next_i,
                    &prev_i,
                    &tauri::menu::PredefinedMenuItem::separator(app)?,
                    &show_i,
                    &quit_i,
                ])
                .build()?;

            // Build Tray Icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app_handle, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        "play-pause" => {
                            let _ = app_handle.emit("media-action", "play-pause");
                        }
                        "next" => {
                            let _ = app_handle.emit("media-action", "next");
                        }
                        "prev" => {
                            let _ = app_handle.emit("media-action", "prev");
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        let app_handle = tray.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory_native,
            read_lrc_file,
            show_item_in_folder,
            open_external_url,
            parse_metadata_native,
            write_mp3_tags,
            write_text_file,
            read_text_file,
            trash_file,
            rename_file,
            copy_file,
            move_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
