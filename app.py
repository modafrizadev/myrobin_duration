import os
from datetime import datetime, timedelta
from collections import defaultdict
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

def format_hms(td):
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours} H {minutes} M {seconds} S"

def run_scanner():
    drive = drive_var.get()
    code = code_entry.get().strip()
    
    if not code or len(code) != 4 or not code.isdigit():
        messagebox.showerror("Error", "Masukkan 4 digit kode kamera dengan benar (contoh: 3047)")
        return
        
    target_folder = f"{drive}:\\recording\\atlascm{code}"
    
    if not os.path.exists(target_folder):
        messagebox.showerror("Folder Tidak Ditemukan", f"Direktori berikut tidak ditemukan:\n{target_folder}")
        return

    # Bersihkan text area
    output_area.delete(1.0, tk.END)
    output_area.insert(tk.END, f"Memindai folder: {target_folder}\n" + "="*50 + "\n\n")
    root.update()

    grouped_data = defaultdict(list)
    found_files = 0

    for root_dir, dirs, files in os.walk(target_folder):
        for file in files:
            if file.endswith(".enc"):
                found_files += 1
                file_path = os.path.join(root_dir, file)
                
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
                    print(f"Gagal membaca file {file}: {e}")

    if found_files == 0:
        output_area.insert(tk.END, "Tidak ditemukan file .enc di dalam folder tersebut.\n")
        return

    grand_total_seconds = 0
    dates_list = sorted(grouped_data.keys())

    for date_str in dates_list:
        items = grouped_data[date_str]
        date_total_seconds = sum([item["duration"].total_seconds() for item in items])
        grand_total_seconds += date_total_seconds
        
        output_area.insert(tk.END, f"tanggal {date_str} > {format_hms(timedelta(seconds=date_total_seconds))}\n")
        
        for idx, item in enumerate(items, 1):
            dur_str = format_hms(item["duration"])
            start_str = item["start"].strftime('%H:%M:%S')
            end_str = item["end"].strftime('%H:%M:%S')
            output_area.insert(tk.END, f"   {idx}. {dur_str} ({start_str} - {end_str}) [File: {item['file']}]\n")
        output_area.insert(tk.END, "\n")

    output_area.insert(tk.END, "="*40 + "\n")
    min_date = dates_list[0].split('-')[-1]
    max_date = dates_list[-1].split('-')[-1]
    
    # Label rentang tanggal dinamis (misal: Total 19-20 atau Total 18-21)
    if min_date == max_date:
        range_label = min_date
    else:
        range_label = f"{min_date}-{max_date}"
        
    output_area.insert(tk.END, f"Total {range_label} > {format_hms(timedelta(seconds=grand_total_seconds))}\n")

# Deteksi drive yang ada di komputer (C, D, E, dst.)
available_drives = [d for d in ["C", "D", "E", "F", "G"] if os.path.exists(f"{d}:\\")]
if not available_drives:
    available_drives = ["C"]

# --- SETUP TAMPILAN UI ---
root = tk.Tk()
root.title("Rekap Durasi File .enc Kamera")
root.geometry("600x550")
root.minsize(550, 500)

# Frame Input
input_frame = ttk.LabelFrame(root, text=" Pengaturan Direktori ", padding=15)
input_frame.pack(fill="x", padx=15, pady=15)

# Pilihan Partisi Drive
ttk.Label(input_frame, text="Partisi Drive:").grid(row=0, column=0, sticky="w", pady=5)
drive_var = tk.StringVar(value=available_drives[0] if "D" not in available_drives else "D")
drive_dropdown = ttk.Combobox(input_frame, textvariable=drive_var, values=available_drives, width=5, state="readonly")
drive_dropdown.grid(row=0, column=1, sticky="w", padx=10, pady=5)
ttk.Label(input_frame, text=r":\recording\atlascm").grid(row=0, column=2, sticky="w")

# Input 4 Digit Kode Kamera
code_entry = ttk.Entry(input_frame, width=8)
code_entry.grid(row=0, column=3, sticky="w", padx=5, pady=5)
code_entry.insert(0, "3047")  # Default contoh

# Tombol Eksekusi
run_btn = ttk.Button(input_frame, text="Mulai Hitung", command=run_scanner)
run_btn.grid(row=0, column=4, padx=10, pady=5)

# Frame Output Hasil
output_frame = ttk.LabelFrame(root, text=" Hasil Analisis ", padding=10)
output_frame.pack(fill="both", expand=True, padx=15, pady=(0, 15))

output_area = scrolledtext.ScrolledText(output_frame, wrap=tk.WORD, font=("Consolas", 10))
output_area.pack(fill="both", expand=True)

root.mainloop()