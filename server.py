import os
import json
import urllib.parse
from datetime import datetime, timedelta
from collections import defaultdict
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def format_hms(td):
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours} H {minutes} M {seconds} S"

def format_indo_duration(td):
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours} jam {minutes} menit {seconds} detik."

def format_indo_date(date_str):
    months = [
        "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ]
    try:
        parts = date_str.split('-')
        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
        return f"{day} {months[month]} {year}"
    except Exception:
        return date_str

def get_available_drives():
    available = []
    for letter in "CDEFGHIJKLMNOPQRSTUVWXYZ":
        root = f"{letter}:\\"
        if os.path.exists(root):
            has_recording = os.path.exists(os.path.join(root, "recording"))
            available.append({
                "letter": letter,
                "label": f"Drive {letter}:" + (" (Ada folder recording)" if has_recording else ""),
                "has_recording": has_recording
            })
    
    available.sort(key=lambda x: (not x["has_recording"], x["letter"] != "D", x["letter"]))
    return available

def find_target_folder(code, drive="AUTO", custom_path=""):
    if custom_path and custom_path.strip():
        cp = custom_path.strip()
        if os.path.exists(cp):
            return cp, "Custom", None
        return None, None, f"Folder kustom tidak ditemukan:\n{cp}"

    all_drives = [d["letter"] for d in get_available_drives()]
    
    if drive and drive.upper() != "AUTO":
        target_drives = [drive.upper().rstrip(":\\")]
    else:
        target_drives = all_drives if all_drives else ["D", "C"]
        if "D" not in target_drives:
            target_drives.append("D")

    searched_paths = []

    for d in target_drives:
        path1 = f"{d}:\\recording\\atlascm{code}"
        searched_paths.append(path1)
        if os.path.exists(path1):
            return path1, d, None

        path2 = f"{d}:\\atlascm{code}"
        searched_paths.append(path2)
        if os.path.exists(path2):
            return path2, d, None

    for d in target_drives:
        rec_dir = f"{d}:\\recording"
        if os.path.isdir(rec_dir):
            try:
                for entry in os.listdir(rec_dir):
                    if f"atlascm{code}".lower() in entry.lower():
                        full = os.path.join(rec_dir, entry)
                        if os.path.isdir(full):
                            return full, d, None
            except Exception:
                pass

    connected_str = ", ".join([f"{d}:" for d in all_drives]) if all_drives else "Tidak terdeteksi"
    error_msg = (
        f"Folder kamera untuk kode '{code}' (atlascm{code}) tidak ditemukan!\n\n"
        f"Drive aktif di komputer saat ini: {connected_str}\n"
        f"Jalur yang telah dicari otomatis:\n" + "\n".join([f"• {p}" for p in searched_paths[:4]]) + "\n\n"
        f"💡 Solusi:\n"
        f"1. Pastikan flashdisk / kartu SD / harddisk kamera sudah dicolokkan ke laptop.\n"
        f"2. Periksa kembali 4 digit nomor seri kamera (contoh: 3047)."
    )
    return None, None, error_msg

def scan_camera_folder(target_folder, detected_drive):
    grouped_data = defaultdict(list)
    found_files = 0

    for root, dirs, files in os.walk(target_folder):
        for file in files:
            if file.endswith(".enc"):
                found_files += 1
                file_path = os.path.join(root, file)
                try:
                    created_time = os.path.getctime(file_path)
                    modified_time = os.path.getmtime(file_path)
                    
                    dt_created = datetime.fromtimestamp(created_time)
                    dt_modified = datetime.fromtimestamp(modified_time)
                    
                    date_key = dt_created.strftime('%Y-%m-%d')
                    duration = dt_modified - dt_created
                    
                    grouped_data[date_key].append({
                        "file": file,
                        "start": dt_created,
                        "end": dt_modified,
                        "duration": duration
                    })
                except Exception as e:
                    print(f"Error membaca metadata file {file}: {e}")

    if found_files == 0:
        return {
            "success": False,
            "error": f"Folder {target_folder} ditemukan, tetapi tidak ada file berekstensi .enc di dalamnya."
        }

    grand_total_seconds = 0
    dates_list = sorted(grouped_data.keys())

    formatted_groups = []
    summary_per_date = []

    text_lines = [
        "========================================",
        f"  LOKASI FOLDER : {target_folder}",
        f"  TOTAL FILE    : {found_files} file .enc",
        "========================================\n"
    ]

    text_lines.append("=== RINGKASAN PER TANGGAL ===")

    for date_str in dates_list:
        items = grouped_data[date_str]
        date_total_seconds = sum([item["duration"].total_seconds() for item in items])
        grand_total_seconds += date_total_seconds
        
        first_start = min(item["start"] for item in items).strftime('%H:%M:%S')
        last_end = max(item["end"] for item in items).strftime('%H:%M:%S')
        date_total_hms = format_hms(timedelta(seconds=date_total_seconds))
        date_total_indo = format_indo_duration(timedelta(seconds=date_total_seconds))
        date_indo = format_indo_date(date_str)
        hours_dec = round(date_total_seconds / 3600, 2)
        
        text_lines.append(f"• Tanggal {date_str} ({date_indo}) > {date_total_hms} ({date_total_indo})")
        
        summary_per_date.append({
            "date": date_str,
            "date_indo": date_indo,
            "total_hms": date_total_hms,
            "total_indo": date_total_indo,
            "total_hours": hours_dec,
            "total_seconds": date_total_seconds,
            "file_count": len(items),
            "start_time": first_start,
            "end_time": last_end
        })

        items_data = []
        for idx, item in enumerate(items, 1):
            dur_str = format_hms(item["duration"])
            dur_indo = format_indo_duration(item["duration"])
            start_str = item["start"].strftime('%H:%M:%S')
            end_str = item["end"].strftime('%H:%M:%S')
            text_lines.append(f"   {idx}. {dur_str} ({start_str} - {end_str}) [File: {item['file']}]")
            items_data.append({
                "index": idx,
                "file": item["file"],
                "duration": dur_str,
                "duration_indo": dur_indo,
                "duration_seconds": item["duration"].total_seconds(),
                "start": start_str,
                "end": end_str
            })

        formatted_groups.append({
            "date": date_str,
            "date_indo": date_indo,
            "total_hms": date_total_hms,
            "total_indo": date_total_indo,
            "total_hours": hours_dec,
            "total_seconds": date_total_seconds,
            "file_count": len(items),
            "start_time": first_start,
            "end_time": last_end,
            "items": items_data
        })

    min_date = dates_list[0].split('-')[-1]
    max_date = dates_list[-1].split('-')[-1]
    range_label = min_date if min_date == max_date else f"{min_date}-{max_date}"
    grand_total_hms = format_hms(timedelta(seconds=grand_total_seconds))
    grand_total_hours = round(grand_total_seconds / 3600, 2)
    grand_total_indo = format_indo_duration(timedelta(seconds=grand_total_seconds))

    text_lines.append("----------------------------------------")
    text_lines.append(f"Total {range_label} > {grand_total_hms} ({grand_total_hours} jam | {grand_total_indo})\n")

    text_lines.append("=== DETAIL PER TANGGAL & FILE ===")
    for g in formatted_groups:
        text_lines.append(f"\ntanggal {g['date']} ({g['date_indo']}) > {g['total_hms']}")
        for item in g["items"]:
            text_lines.append(f"   {item['index']}. {item['duration']} ({item['start']} - {item['end']}) [File: {item['file']}]")

    text_lines.append("\n" + "=" * 40)
    text_lines.append(f"Total {range_label} > {grand_total_hms}")
    raw_text = "\n".join(text_lines)

    return {
        "success": True,
        "target_folder": target_folder,
        "detected_drive": detected_drive,
        "found_files": found_files,
        "dates_count": len(dates_list),
        "range_label": range_label,
        "grand_total_hms": grand_total_hms,
        "grand_total_hours": grand_total_hours,
        "grand_total_indo": grand_total_indo,
        "summary_per_date": summary_per_date,
        "groups": formatted_groups,
        "raw_text": raw_text
    }

class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/drives':
            drives = get_available_drives()
            self._send_json({"drives": drives})
        elif parsed.path == '/api/scan':
            query = urllib.parse.parse_qs(parsed.query)
            drive = query.get('drive', ['AUTO'])[0]
            code = query.get('code', ['3047'])[0].strip()
            custom_path = query.get('path', [''])[0].strip()
            
            target_folder, detected_drive, err = find_target_folder(code, drive, custom_path)
            if err:
                self._send_json({"success": False, "error": err})
                return

            result = scan_camera_folder(target_folder, detected_drive)
            self._send_json(result)
        else:
            super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def _send_json(self, data):
        response_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        self.wfile.write(response_bytes)

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, AppRequestHandler)
    print(f"Backend Server aktif di http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == '__main__':
    run_server()
