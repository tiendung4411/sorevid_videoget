#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if bilibili_downloader_lib::should_run_native_messaging() {
        if let Err(error) = bilibili_downloader_lib::run_native_messaging() {
            eprintln!("{error}");
        }
        return;
    }

    bilibili_downloader_lib::run()
}
