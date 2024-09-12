// Funkcija za dohvaćanje statusa printera
function getPrinterStatus() {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, 'M27');  // Komanda za prikaz statusa ispisa

    fetch('/api/control', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ printer_id: printerId, gcode_command: 'M27' })
    }).then(response => response.json())
      .then(data => {
          document.getElementById('printer-status').textContent = `Status: ${data.response}`;
      });
}

// Updated sendGcode function to handle multiple printers
function sendGcode(printerIds, gcode, callback) {
    printerIds.forEach(printerId => {
        fetch('/api/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ printer_id: printerId, gcode_command: gcode })
        })
        .then(response => response.json())
        .then(data => {
            console.log(`G-code response from ${printerId}:`, data);
            if (callback) {
                callback();
            }
        })
        .catch(error => {
            console.error(`Error sending G-code to ${printerId}:`, error);
            addNotification(printerId, 'Error sending G-code.');
        });
    });
}

// Function to check the hotend temperature and enable/disable filament buttons using G-code
function checkHotendTemperature() {
    const printerIds = ['prusa_mk2s_1', 'prusa_mk2s_2', 'prusa_mk2s_3', 'prusa_mk2s_4', 'prusa_mk2s_5', 'prusa_mk2s_6', 'prusa_mk2s_7', 'prusa_mk2s_8', 'prusa_mk2s_9', 'prusa_mk2s_10'];

    printerIds.forEach(printerId => {
        // Send G-code to the printer to check temperature
        fetch('/api/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ printer_id: printerId, gcode_command: 'M105' }),
        })
        .then(response => response.json())
        .then(data => {
            const loadFilamentBtn = document.getElementById(`load-filament-${printerId}`);
            const unloadFilamentBtn = document.getElementById(`unload-filament-${printerId}`);
            const messageElement = document.getElementById(`filament-message-${printerId}`);

            if (data.status === 'success' && data.response.gcode_output) {
                const gcodeOutput = data.response.gcode_output;
                // Extract hotend temperature (T) from the G-code response
                const tempMatch = gcodeOutput.match(/T:(\d+\.?\d*)/);
                
                if (tempMatch) {
                    const hotendTemp = parseFloat(tempMatch[1]);

                    // Check if the hotend temperature is at least 190°C
                    if (hotendTemp >= 190) {
                        loadFilamentBtn.disabled = false;
                        unloadFilamentBtn.disabled = false;
                        messageElement.style.display = 'none';  // Hide the message when buttons are enabled
                    } else {
                        loadFilamentBtn.disabled = true;
                        unloadFilamentBtn.disabled = true;
                        messageElement.style.display = 'block';  // Show the message when buttons are disabled
                    }
                }
            } else {
                loadFilamentBtn.disabled = true;
                unloadFilamentBtn.disabled = true;
                messageElement.style.display = 'block';  // Show the message when there's an error
            }
        })
        .catch(error => {
            console.error('Error fetching temperature:', error);
            document.getElementById('printer-status').textContent = 'Status: Error fetching temperature.';
        });
    });
}

// Periodically check temperature for all printers every 5 seconds
setInterval(checkHotendTemperature, 5000);



// Funkcija za učitavanje filamenta
function loadFilament() {
    const printerId = getSelectedPrinter();
    sendGcode(printerId, 'M701');  // G-code za učitavanje filamenta
    addNotification(printerId, 'Filament loaded');
}

// Funkcija za izbacivanje filamenta
function unloadFilament() {
    const printerId = getSelectedPrinter();
    sendGcode(printerId, 'M702');  // G-code za izbacivanje filamenta
    addNotification(printerId, 'Filament unloaded');
}


// Function to move the axis for a specific printer
function moveAxis(printerId, axis, direction) {
    let gcodeCommand;

    // Define movement based on axis and direction
    switch (axis) {
        case 'x':
            gcodeCommand = direction === 'left' ? 'G1 X-10 F3000' : 'G1 X10 F3000';
            break;
        case 'y':
            gcodeCommand = direction === 'back' ? 'G1 Y-10 F3000' : 'G1 Y10 F3000';
            break;
        case 'z':
            gcodeCommand = direction === 'down' ? 'G1 Z-10 F3000' : 'G1 Z10 F3000';
            break;
    }

    // Send the G-code to the corresponding printer
    sendGcode(printerId, gcodeCommand);
}

// Function to generate calibration cards for each printer
function generateCalibrationCards() {
    const calibrationContainer = document.getElementById('calibration-container');
    calibrationContainer.innerHTML = '';  // Clear any existing content

    printerIds.forEach(printerId => {
        const printerCard = document.createElement('div');
        printerCard.classList.add('printer-card');
        printerCard.innerHTML = `
            <h3>${printerId.replace('_', ' ').toUpperCase()}</h3>
            <button onclick="autoHome('${printerId}')">Auto Home</button>
            <button onclick="meshBedLeveling('${printerId}')">Mesh Bed Leveling</button>
            <button onclick="resetXYZCalibration('${printerId}')">Reset XYZ Calibration</button>
        `;
        calibrationContainer.appendChild(printerCard);  // Add card to the grid
    });
}

// Trigger generating calibration cards on Calibration tab click
document.querySelector('.tablinks[onclick="openTab(event, \'Calibration\')"]').addEventListener('click', generateCalibrationCards);

// Calibration functions for each printer
function autoHome(printerId) {
    sendGcode(printerId, 'G28');
    addNotification(printerId, 'Auto Home executed.');
}

function meshBedLeveling(printerId) {
    sendGcode(printerId, 'G80');
    sendGcode(printerId, 'G29');
    addNotification(printerId, 'Mesh Bed Leveling in progress.');
}

function resetXYZCalibration(printerId) {
    sendGcode(printerId, 'M502');
    addNotification(printerId, 'XYZ Calibration reset.');
}

// Funkcija za otvaranje notifikacijskog modala
function openNotifications() {
    document.getElementById('notificationModal').style.display = 'block';
}

// Funkcija za zatvaranje notifikacijskog modala
function closeNotifications() {
    document.getElementById('notificationModal').style.display = 'none';
}



// Function to apply preheat settings to all selected printers
function preheat(material) {
    const printerIds = getSelectedPrinters(); // Get selected printers (single or multiple)
    let hotendTemp, bedTemp, materialName;

    // Set temperatures based on the selected material
    switch (material) {
        case 'PLA':
            hotendTemp = 215;
            bedTemp = 55;
            materialName = 'PLA';
            break;
        case 'ABS':
            hotendTemp = 255;
            bedTemp = 100;
            materialName = 'ABS';
            break;
        case 'PET':
            hotendTemp = 240;
            bedTemp = 90;
            materialName = 'PET';
            break;
        case 'HIPS':
            hotendTemp = 220;
            bedTemp = 100;
            materialName = 'HIPS';
            break;
        case 'FLEX':
            hotendTemp = 230;
            bedTemp = 50;
            materialName = 'FLEX';
            break;
        default:
            return;
    }

    // Send the preheat command once to each printer
    printerIds.forEach(printerId => {
        sendGcode(printerId, `M104 S${hotendTemp}`);  // Set hotend temperature
        sendGcode(printerId, `M140 S${bedTemp}`);     // Set bed temperature
        addNotification(printerId, `Preheating for ${materialName} (Hotend: ${hotendTemp}°C, Bed: ${bedTemp}°C)`);
    });
}

// Function to monitor printer status (fetching periodically without sending commands)
function monitorPrinterStatus() {
    const printerIds = getSelectedPrinters();

    printerIds.forEach((printerId, index) => {
        setTimeout(() => {
            fetch('/api/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ printer_id: printerId }),  // No G-code commands, just retrieve status
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const printerStatus = data.response;
                    updateStatusDisplay(printerId, printerStatus);
                }
            })
            .catch(error => {
                console.error('Error fetching status:', error);
            });
        }, index * 2000);  // Stagger status checks with 2-second delay between printers
    });
}


// Periodically monitor printer status every 5 seconds
setInterval(monitorPrinterStatus, 5000);

  function updateStatusDisplay(printerId, status) {
    // Get relevant elements
    const controlPanelStatusElement = document.getElementById(`status-${printerId}`);
    const calibrationStatusElement = document.getElementById(`status-${printerId}-calibration`);
    const settingsStatusElement = document.getElementById(`status-${printerId}-settings`);
    const printerCardElement = controlPanelStatusElement.closest('.printer-card'); // Use closest to get the parent printer card

    if (printerCardElement) {
        // Update the control panel status
        controlPanelStatusElement.innerHTML = `
            <p>Print Status: ${status.print_status || 'N/A'}</p>
            <p>Hotend Temp: ${status.hotend_temp || 'N/A'} °C | Bed Temp: ${status.bed_temp || 'N/A'} °C</p>
        `;

        // Add or remove the 'printer-unavailable' class based on the print status
        if (status.print_status === 'N/A') {
            printerCardElement.classList.add('printer-unavailable');
        } else {
            printerCardElement.classList.remove('printer-unavailable');
        }

        // Update status for Calibration, if the element exists
        if (calibrationStatusElement) {
            calibrationStatusElement.innerHTML = `
                <p>Print Status: ${status.print_status || 'N/A'}</p>
                <p>Hotend Temp: ${status.hotend_temp || 'N/A'} °C | Bed Temp: ${status.bed_temp || 'N/A'} °C</p>
            `;
        }

        // Update status for Settings, if the element exists
        if (settingsStatusElement) {
            settingsStatusElement.innerHTML = `
                <p>Print Status: ${status.print_status || 'N/A'}</p>
                <p>Hotend Temp: ${status.hotend_temp || 'N/A'} °C | Bed Temp: ${status.bed_temp || 'N/A'} °C</p>
            `;
        }
    }
}


// Funkcija za cooldown
function cooldown() {
    const printerId = document.getElementById('printer-select').value;
    
    sendGcode(printerId, 'M104 S0');  // Ugasi mlaznicu
    sendGcode(printerId, 'M140 S0');  // Ugasi podlogu
    addNotification(printerId, 'Cooldown initiated (Hotend: 0°C, Bed: 0°C)');
}

// Funkcija za dodavanje notifikacije u modal
function addNotification(printerId, message) {
    const notificationList = document.getElementById('notification-list');
    const notification = document.createElement('div');

    // Dobij trenutni datum i vrijeme
    const now = new Date();
    const dateTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    // Kreiraj tekst notifikacije
    notification.textContent = `${dateTime} - Printer: ${printerId} - ${message}`;
    
    // Dodaj notifikaciju u listu
    notificationList.appendChild(notification);
}

// Automatski dohvaćaj status printera svakih 5 sekundi
setInterval(getPrinterStatus, 5000);

// Ensure Control Panel updates when the tab is clicked
document.querySelector('.tablinks[onclick="openTab(event, \'ControlPanel\')"]').addEventListener('click', updateControlPanel);

document.addEventListener('DOMContentLoaded', () => {
    updateControlPanel();
});

// Fetch and display the printer status in each card
function updateControlPanel() {
    const printerIds = ['prusa_mk2s_1', 'prusa_mk2s_2', 'prusa_mk2s_3', 'prusa_mk2s_4', 'prusa_mk2s_5', 'prusa_mk2s_6', 'prusa_mk2s_7', 'prusa_mk2s_8', 'prusa_mk2s_9', 'prusa_mk2s_10'];
    
    const controlPanelContainer = document.getElementById('control-panel-container');
    controlPanelContainer.innerHTML = '';  // Clear any existing content

    printerIds.forEach(printerId => {
        // Create a card for each printer
        const printerCard = document.createElement('div');
        printerCard.classList.add('printer-card');
        printerCard.innerHTML = `
            <!-- Top section for printer status -->
            <div class="printer-status" id="status-${printerId}">
                <h3>${printerId.replace('_', ' ').toUpperCase()}</h3>
                <p>Status: Loading...</p>
                <p>Hotend Temp: N/A °C | Bed Temp: N/A °C</p>
            </div>

            <!-- Bottom section with three columns -->
            <div class="printer-controls-grid">
                <div class="control-column">
                    <h4>Preheat/Cooldown</h4>
                    <button onclick="preheat('${printerId}', 'PLA')">Preheat PLA</button>
                    <button onclick="preheat('${printerId}', 'ABS')">Preheat ABS</button>
                    <button onclick="preheat('${printerId}', 'PET')">Preheat PET</button>
                    <button onclick="cooldown('${printerId}')">Cooldown</button>
                </div>

                <div class="control-column">
                    <h4>Printing</h4>
   <!-- Hidden file input -->
    <input type="file" id="file-input-${printerId}" accept=".gcode" style="display:none" onchange="handleFileSelect('${printerId}')"/>
    
    <!-- Label styled as a button -->
    <label for="file-input-${printerId}" class="choose-file-button">Choose File (.gcode)</label>
    
    <!-- Display the selected file name -->
    <span id="file-name-display-${printerId}">${selectedFileNames[printerId] || 'No file selected'}</span>
    
    <!-- Print controls -->
    <button onclick="startPrint('${printerId}')" disabled id="start-print-${printerId}">Start Print</button>
    <button onclick="pausePrint('${printerId}')">Pause Print</button>
    <button onclick="resumePrint('${printerId}')">Resume Print</button>
    <button onclick="cancelPrint('${printerId}')">Cancel Print</button>
 <p style="margin-bottom: 40px;"><small><em>To enable Start Print button, select a file.</em></small></p> <!-- Instruction added -->
                </div>
 <! <!-- Third column for Filament Controls and Message -->
                <div class="control-column">
                    <h4>Filament Controls</h4>
                    <button id="load-filament-${printerId}" onclick="loadFilament('${printerId}')" disabled>Load Filament</button>
                    <button id="unload-filament-${printerId}" onclick="unloadFilament('${printerId}')" disabled>Unload Filament</button>
                    <p id="filament-message-${printerId}">
                     <small>The hotend nozzle must be over 190°C to enable these buttons.</small>
                    </p>                
    </div>
            </div>
        `;
        controlPanelContainer.appendChild(printerCard);

        // Fetch and update the printer status
        fetchPrinterStatus(printerId);
    });
}


// Funkcija za rukovanje odabirom fajla
function handleFileSelect(printerId) {
    const fileInput = document.getElementById(`file-input-${printerId}`);
    const fileNameDisplay = document.getElementById(`file-name-display-${printerId}`);
    const startPrintButton = document.getElementById(`start-print-${printerId}`);
    const file = fileInput.files[0];

    if (file) {
        // Provjera je li odabrani fajl .gcode
        if (file.name.endsWith('.gcode')) {
            selectedFileNames[printerId] = file.name;  // Pohrani naziv fajla za svaki printer
            fileNameDisplay.textContent = file.name;  // Prikazuj ime fajla u UI
            startPrintButton.disabled = false;  // Omogući dugme za pokretanje printanja
        } else {
            fileNameDisplay.textContent = 'Invalid file. Please select a .gcode file.';
            startPrintButton.disabled = true;  // Onemogući dugme ako fajl nije validan
        }
    }
}


// Function to start the print after uploading the file
function startPrint(printerId) {
    const fileInput = document.getElementById(`file-input-${printerId}`);
    const file = fileInput.files[0];

    if (!file) {
        alert('No file selected.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch(`/api/upload_gcode_and_print/${printerId}`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            addNotification(printerId, `Print started for file: ${file.name}`);
            // Make sure to eject SD card mode from the printer
            fetch('/api/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ printer_id: printerId, gcode_command: 'M22' }) // Eject SD card
            });
        } else {
            alert(`Failed to print: ${data.message}`);
            addNotification(printerId, `Failed to print: ${data.message}`);
        }
    })
    .catch(error => {
        console.error('Error during printing:', error);
        alert('Error during printing.');
        addNotification(printerId, 'Error during printing.');
    });
}


// Fetch the list of printers from the backend
function fetchPrinterIds() {
    return fetch('/api/printers')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                return data.printers; // Return the list of printer IDs
            } else {
                console.error('Failed to fetch printer IDs');
                return [];
            }
        })
        .catch(error => {
            console.error('Error fetching printer IDs:', error);
            return [];
        });
}

// Function to fetch printer status and update the UI, including enabling/disabling filament buttons
function fetchPrinterStatus(printerId) {
    fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_id: printerId }),
    })
    .then(response => response.json())
    .then(data => {
        const statusElement = document.getElementById(`status-${printerId}`);
        const loadFilamentBtn = document.getElementById(`load-filament-${printerId}`);
        const unloadFilamentBtn = document.getElementById(`unload-filament-${printerId}`);

        if (data.status === 'success') {
            const printerStatus = data.response;
            const hotendTemp = printerStatus.hotend_temp || 'N/A';

            // Update printer status display
            statusElement.innerHTML = `
                <h3>${printerId.replace('_', ' ').toUpperCase()}</h3>
                <p>Print Status: ${printerStatus.print_status || 'N/A'}</p>
                <p>Hotend Temp: ${hotendTemp} °C | Bed Temp: ${printerStatus.bed_temp || 'N/A'} °C</p>
            `;

            // Enable or disable the filament buttons based on the hotend temperature
            if (hotendTemp !== 'N/A' && parseFloat(hotendTemp) > 190) {
                loadFilamentBtn.disabled = false;
                unloadFilamentBtn.disabled = false;
            } else {
                loadFilamentBtn.disabled = true;
                unloadFilamentBtn.disabled = true;
            }
        } else {
            statusElement.innerHTML = `<p>Printer not found or disconnected</p>`;
            loadFilamentBtn.disabled = true;
            unloadFilamentBtn.disabled = true;
        }
    })
    .catch(error => {
        console.error('Error fetching printer status:', error);
        const statusElement = document.getElementById(`status-${printerId}`);
        statusElement.innerHTML = `<p>Error fetching status</p>`;
        loadFilamentBtn.disabled = true;
        unloadFilamentBtn.disabled = true;
    });
}

// Periodically fetch the status for all printers every 5 seconds
setInterval(async () => {
    const printerIds = await fetchPrinterIds(); // Fetch printer IDs dynamically
    printerIds.forEach(printerId => fetchPrinterStatus(printerId));
}, 2000); // Set to 2 seconds (2000 milliseconds)



// Example of sending a preheat command to a specific printer
function preheat(printerId, material) {
    let hotendTemp, bedTemp;
    if (material === 'PLA') {
        hotendTemp = 215;
        bedTemp = 60;
    } else if (material === 'ABS') {
        hotendTemp = 240;
        bedTemp = 100;
    } else if (material === 'PET') {
        hotendTemp = 230;
        bedTemp = 90;
    }

    sendGcode(printerId, `M104 S${hotendTemp}`);  // Set hotend temp
    sendGcode(printerId, `M140 S${bedTemp}`);     // Set bed temp
}

function cooldown(printerId) {
    sendGcode(printerId, 'M104 S0');  // Turn off hotend
    sendGcode(printerId, 'M140 S0');  // Turn off bed
}

//function startPrint(printerId) {
 //   sendGcode(printerId, 'M24');
 //   addNotification(printerId, 'Print started');
//}

function pausePrint(printerId) {
    sendGcode(printerId, 'M25');  // Pause print
    addNotification(printerId, 'Print paused');

}

function resumePrint(printerId) {
    sendGcode(printerId, 'M24');  // Resume print
    addNotification(printerId, 'Print resumed');

}

function cancelPrint(printerId) {
    sendGcode(printerId, 'M26');  // Cancel print
    addNotification(printerId, 'Print canceled');

}

function loadFilament(printerId) {
    sendGcode(printerId, 'M701');  // Load filament
}

function unloadFilament(printerId) {
    sendGcode(printerId, 'M702');  // Unload filament
}

// Function to send G-code to a specific printer
function sendGcode(printerId, gcode) {
    fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_id: printerId, gcode_command: gcode })
    })
    .then(response => response.json())
    .then(data => console.log(`G-code sent to ${printerId}: ${gcode}`, data))
    .catch(error => console.error(`Error sending G-code to ${printerId}:`, error));
}


