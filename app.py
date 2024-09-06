from flask import Flask, render_template, request, jsonify
import serial
import time

app = Flask(__name__)

# Simulirani printeri - ovo možeš kasnije zamijeniti stvarnim serijskim ID-ovima na Raspberryju
printers = {
    'prusa_mk2s_1': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65447-if00',
    'prusa_mk2s_4': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65440-if00'
}

# Funkcija za slanje G-code komandi printeru
def send_gcode(printer_id, gcode_command):
    serial_port = printers.get(printer_id)
    if serial_port:
        try:
            # Otvaranje serijske veze s printerom
            with serial.Serial(serial_port, 115200, timeout=5) as ser:
                time.sleep(2)  # Dajemo printeru vremena da se pokrene
                ser.write((gcode_command + '\n').encode())  # Šaljemo G-code
                ser.flush()
                return "G-code sent: " + gcode_command
        except (serial.SerialException, OSError):
            # Prijateljska poruka za slučaj problema s portom
            return "Printer not found or disconnected"
    else:
        return "Printer not found or disconnected"

# Početna stranica
@app.route('/')
def index():
    return render_template('index.html')

# API za upravljanje printerima
@app.route('/api/control', methods=['POST'])
def control_printer():
    data = request.json
    printer_id = data.get('printer_id')
    gcode_command = data.get('gcode_command')
    response = send_gcode(printer_id, gcode_command)
    return jsonify({'status': 'success', 'response': response})

# Funkcija za dohvaćanje statusa ispisa (M27), temperature (M105) i krajnjih prekidača (M119)
def get_printer_status(printer_id):
    serial_port = printers.get(printer_id)
    if serial_port:
        try:
            with serial.Serial(serial_port, 115200, timeout=5) as ser:
                time.sleep(2)  # Allow the printer some time to initialize

                # Fetch Print Status (M27)
                ser.write(b'M27\n')
                ser.flush()
                print_status_raw = ser.readline().decode('utf-8').strip()

                # Fetch Temperature (M105)
                ser.write(b'M105\n')
                ser.flush()
                temp_status_raw = ser.readline().decode('utf-8').strip()

                # Parse temperature from the M105 response
                hotend_temp, bed_temp = None, None
                if "T:" in temp_status_raw:
                    hotend_temp = temp_status_raw.split("T:")[1].split(" ")[0]
                if "B:" in temp_status_raw:
                    bed_temp = temp_status_raw.split("B:")[1].split(" ")[0]

                # Clean print status (Extract relevant part)
                if "SD printing" in print_status_raw:
                    print_status = "Printing" if "SD printing" in print_status_raw else "Idle"
                else:
                    print_status = "Not SD printing"

                # Return parsed status information
                return {
                    'print_status': print_status,
                    'hotend_temp': hotend_temp if hotend_temp else "N/A",
                    'bed_temp': bed_temp if bed_temp else "N/A"
                }

        except (serial.SerialException, OSError):
            return {'error': "Printer not found or disconnected"}
    else:
        return {'error': "Printer not found or disconnected"}



@app.route('/api/status', methods=['POST'])
def printer_status():
    data = request.json
    printer_id = data.get('printer_id')
    status = get_printer_status(printer_id)
    return jsonify({'status': 'success', 'response': status})

# Funkcija za dohvaćanje popisa datoteka sa SD kartice (M20)
def get_sd_files(printer_id):
    serial_port = printers.get(printer_id)
    if serial_port:
        try:
            with serial.Serial(serial_port, 115200, timeout=5) as ser:
                time.sleep(2)  # Dajemo printeru vremena da se pokrene
                
                # Fetch SD card files (M20)
                ser.write(b'M20\n')
                ser.flush()
                files_list = []
                while True:
                    response = ser.readline().decode('utf-8').strip()
                    if response.startswith('End file list'):
                        break
                    files_list.append(response)
                return files_list
        except (serial.SerialException, OSError):
            return {"error": "Printer not found or disconnected"}
    else:
        return {"error": "Printer not found or disconnected"}

# Ruta za dohvaćanje datoteka sa SD kartice
@app.route('/api/sd_files', methods=['POST'])
def sd_files():
    data = request.json
    printer_id = data.get('printer_id')
    files = get_sd_files(printer_id)
    return jsonify({'status': 'success', 'files': files})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)
