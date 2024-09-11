import serial
import os
import time
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Directory where the G-code files will be saved
UPLOAD_FOLDER = '/Users/davidsoldatic/EasyPrint/easyprint-1/gcode_files'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure the folder exists

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# Simulirani printeri - zamijeni s pravim ID-ovima za tvoje printere
printers = {
    'prusa_mk2s_1': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65447-if00',
    'prusa_mk2s_4': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65440-if00',
    'prusa_mk2s_2': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_3': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_5': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_6': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_7': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_8': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_9': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_10': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_'    
}

# Create a global variable to store the persistent serial connections
printer_connections = {}

# Function to establish a persistent connection to the printer
def get_serial_connection(printer_id):
    serial_port = printers.get(printer_id)
    if serial_port:
        if printer_id in printer_connections and printer_connections[printer_id].is_open:
            return printer_connections[printer_id], None
        try:
            # Open the connection only if it's not already open
            ser = serial.Serial(serial_port, 115200, timeout=10)
            time.sleep(2)  # Allow the printer time to initialize
            printer_connections[printer_id] = ser
        except (serial.SerialException, OSError) as e:
            return None, str(e)
    return printer_connections.get(printer_id), None


# Function to send G-code command to the printer
def send_gcode(printer_id, gcode_command):
    ser, error = get_serial_connection(printer_id)
    if ser:
        try:
            ser.write((gcode_command + '\n').encode())
            ser.flush()
            return f"G-code sent: {gcode_command}"
        except (serial.SerialException, OSError) as e:
            return f"Error sending G-code: {str(e)}"
    else:
        return error or "Printer not found or disconnected"

# Route to handle G-code commands
@app.route('/api/control', methods=['POST'])
def control_printer():
    data = request.json
    printer_id = data.get('printer_id')
    gcode_command = data.get('gcode_command')
    response = send_gcode(printer_id, gcode_command)
    return jsonify({'status': 'success', 'response': response})

# Route to upload and save G-code file
@app.route('/api/upload_gcode/<printer_id>', methods=['POST'])
def upload_gcode(printer_id):
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '' or not file.filename.lower().endswith('.gcode'):
        return jsonify({'status': 'error', 'message': 'Invalid file format'}), 400


    # Save the file to the upload folder
    filename = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filename)

    # After saving, we can return the filename and proceed to send G-code to the printer
    return jsonify({'status': 'success', 'file_name': file.filename})

# Početna stranica
@app.route('/')
def index():
    return render_template('index.html')


# Funkcija za dohvaćanje statusa ispisa (M27), temperature (M105) i krajnjih prekidača (M119)
def get_printer_status(printer_id):
    ser, error = get_serial_connection(printer_id)
    if ser:
        try:
            # Fetch Print Status (M27)
            ser.write(b'M27\n')
            ser.flush()
            print_status_raw = ser.readline().decode('utf-8').strip()

            # Fetch Temperature (M105)
            ser.write(b'M105\n')
            ser.flush()
            temp_status_raw = ser.readline().decode('utf-8').strip()

            # Fetch Endstop Status (M119)
            ser.write(b'M119\n')
            ser.flush()
            endstop_status_raw = ser.readline().decode('utf-8').strip()

            # Parse temperature from the M105 response
            hotend_temp, bed_temp = None, None
            if "T:" in temp_status_raw:
                hotend_temp = temp_status_raw.split("T:")[1].split(" ")[0]  # Extract hotend temp
            if "B:" in temp_status_raw:
                bed_temp = temp_status_raw.split("B:")[1].split(" ")[0]  # Extract bed temp

            # Parse endstop status
            endstop_status = endstop_status_raw if endstop_status_raw else "N/A"

            # Clean print status (Extract relevant part)
            if "SD printing" in print_status_raw:
                print_status = "Printing"
            else:
                print_status = "Not SD printing"

            # Return parsed status information
            return {
                'print_status': print_status,
                'hotend_temp': hotend_temp if hotend_temp else "N/A",
                'bed_temp': bed_temp if bed_temp else "N/A",
                'endstop_status': endstop_status
            }

        except (serial.SerialException, OSError) as e:
            return {'error': f"Error fetching status: {str(e)}"}
    else:
        return {'error': error or "Printer not found or disconnected"}


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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)
