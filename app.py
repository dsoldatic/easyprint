import serial
import os
import time
from flask import Flask, render_template, request, jsonify
from functools import lru_cache
from threading import Lock
from threading import Thread
from queue import Queue

app = Flask(__name__)

# Directory where the G-code files will be saved
UPLOAD_FOLDER = '/home/pipi/moj_zavrsni/gcode_files' # '/Users/davidsoldatic/EasyPrint/easyprint-1/gcode_files' ,# '/home/pipi/moj_zavrsni/gcode_files'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure the folder exists
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER



# Simulirani printeri - zamijeni s pravim ID-ovima za tvoje printere
printers = {
    'prusa_mk2s_1': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65447-if00',
    'prusa_mk2s_4': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65440-if00',
    'prusa_mk2s_2': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_3': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_5': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX3318X003XK80165-if00',
    'prusa_mk2s_6': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_7': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_8': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_MK2_CZPX2218X003XK65470-if00',
    'prusa_mk2s_9': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_',
    'prusa_mk2s_10': '/dev/serial/by-id/usb-Prusa_Research__prusa3d.com__Original_Prusa_i3_'    
}

# Create a global variable to store the persistent serial connections
printer_connections = {}
printer_command_queues = {}
lock = Lock()

# Inicijaliziramo redove za svakog printera
for printer_id in printers:
    printer_command_queues[printer_id] = Queue()

# Function to establish a persistent connection to the printer
def get_serial_connection(printer_id):
    serial_port = printers.get(printer_id)
    if serial_port:
        if printer_id in printer_connections and printer_connections[printer_id].is_open:
            return printer_connections[printer_id], None
        try:
            ser = serial.Serial(serial_port, 115200, timeout=60)
            time.sleep(2)  # Allow time for connection stabilization
            printer_connections[printer_id] = ser
            return ser, None
        except serial.SerialException as e:
            return None, str(e)
    return None, "Printer not found"

# Funkcija za slanje G-koda sa redom
def process_command_queue(printer_id):
    while True:
        command = printer_command_queues[printer_id].get()
        if command is None:
            break
        send_gcode(printer_id, command)

# Pokreće thread za svaki printer koji procesira komande iz reda
for printer_id in printer_command_queues:
    Thread(target=process_command_queue, args=(printer_id,), daemon=True).start()


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

# Keširaj funkciju dohvaćanja statusa printera na 5 sekundi kako bi smanjili broj poziva
@lru_cache(maxsize=10)
def fetch_printer_status_cached(printer_id):
    return get_printer_status(printer_id)    

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

            # Parse temperature from the M105 response
            hotend_temp, bed_temp = None, None
            if "T:" in temp_status_raw:
                hotend_temp = temp_status_raw.split("T:")[1].split(" ")[0]  # Extract hotend temp
            if "B:" in temp_status_raw:
                bed_temp = temp_status_raw.split("B:")[1].split(" ")[0]  # Extract bed temp


            # Clean print status (Extract relevant part)
            if "USB printing" in print_status_raw:
                print_status = "Printing"
            else:
                print_status = "Not printing"

            # Return parsed status information
            return {
                'print_status': print_status,
                'hotend_temp': hotend_temp if hotend_temp else "N/A",
                'bed_temp': bed_temp if bed_temp else "N/A",
            }

        except (serial.SerialException, OSError) as e:
            return {'error': f"Error fetching status: {str(e)}"}
    else:
        return {'error': error or "Printer not found or disconnected"}


# Function to stream the G-code to the printer line-by-line
def send_gcode_to_printer(printer_id, gcode_file_path):
    serial_port = printers.get(printer_id)
    if not serial_port:
        return {'status': 'error', 'message': 'Printer not found'}

    try:
        with serial.Serial(serial_port, 115200, timeout=60) as ser:
            time.sleep(2) 

            ser.write(b'M22\n')
            ser.flush()

            with open(gcode_file_path, 'r') as gcode_file:
                for line in gcode_file:
                    ser.write(line.encode())  
                    ser.flush()
                    time.sleep(0.05) 

            return {'status': 'success', 'message': f'File {gcode_file_path} sent to printer {printer_id}'}
    except (serial.SerialException, OSError) as e:
        return {'status': 'error', 'message': f'Error sending G-code: {str(e)}'}

# Flask route to upload the G-code file and send it to the printer via USB
@app.route('/api/upload_gcode_and_print/<printer_id>', methods=['POST'])
def upload_gcode_and_print(printer_id):
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '' or not file.filename.lower().endswith('.gcode'):
        return jsonify({'status': 'error', 'message': 'Invalid file format'}), 400

    # Save the uploaded file to the server's G-code folder
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    # Send the G-code file to the printer over USB
    result = send_gcode_to_printer(printer_id, file_path)
    return jsonify(result)

# Route to handle G-code commands
@app.route('/api/control', methods=['POST'])
def control_printer():
    data = request.json
    printer_id = data.get('printer_id')
    gcode_command = data.get('gcode_command')
    # Dodajemo komandu u red printera
    printer_command_queues[printer_id].put(gcode_command)
    response = send_gcode(printer_id, gcode_command)
    return jsonify({'status': 'success', 'response': f'Command {gcode_command} queued for printer {printer_id}'})

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



@app.route('/api/status', methods=['POST'])
def printer_status():
    data = request.json
    printer_id = data.get('printer_id')
    status = get_printer_status(printer_id)
    return jsonify({'status': 'success', 'response': status})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)
