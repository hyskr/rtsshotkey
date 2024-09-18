// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
use std::process::Command;
use tauri::Manager;
use windows::Win32::System::Threading::GetCurrentProcess;
use windows::Win32::UI::Shell::IsUserAnAdmin;

#[tauri::command]
fn check_admin_status() -> bool {
    unsafe { IsUserAnAdmin().as_bool() }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .invoke_handler(tauri::generate_handler![check_admin_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
