// Funkcija za dohvaćanje statusa printera
function getPrinterStatus() {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, 'M27');  // Komanda za prikaz statusa ispisa
    sendGcode(printerId, 'M119'); // Komanda za prikaz krajnjih prekidača

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
function sendGcode(printerId, gcode, callback) {
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
}

// Funkcija za start printa s notifikacijom
function startPrint() {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, 'M24');
    addNotification(printerId, 'Print started');
}

// Funkcija za pauzu printa s notifikacijom
function pausePrint() {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, 'M25');
    addNotification(printerId, 'Print paused');
}

// Function to check the hotend temperature and enable/disable filament buttons
function checkHotendTemperature() {
    const printerIds = ['prusa_mk2s_1', 'prusa_mk2s_2', 'prusa_mk2s_3', 'prusa_mk2s_4', 'prusa_mk2s_5', 'prusa_mk2s_6', 'prusa_mk2s_7', 'prusa_mk2s_8', 'prusa_mk2s_9', 'prusa_mk2s_10'];

    printerIds.forEach(printerId => {
        fetch('/api/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ printer_id: printerId }),
        })
        .then(response => response.json())
        .then(data => {
            const loadFilamentBtn = document.getElementById(`load-filament-${printerId}`);
            const unloadFilamentBtn = document.getElementById(`unload-filament-${printerId}`);
            const messageElement = document.getElementById(`filament-message-${printerId}`);

            if (data.status === 'success' && data.response.hotend_temp !== null) {
                const hotendTemp = data.response.hotend_temp;

                // Check if the hotend temperature is at least 200°C
                if (hotendTemp >= 200) {
                    loadFilamentBtn.disabled = false;
                    unloadFilamentBtn.disabled = false;
                    messageElement.style.display = 'none';  // Hide the message when buttons are enabled
                } else {
                    loadFilamentBtn.disabled = true;
                    unloadFilamentBtn.disabled = true;
                    messageElement.style.display = 'block';  // Show the message when buttons are disabled
                }
            } else {
                loadFilamentBtn.disabled = true;
                unloadFilamentBtn.disabled = true;
                messageElement.style.display = 'block';  // Show the message when there's an error
            }
            messageElement.style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching temperature:', error);
            document.getElementById('printer-status').textContent = 'Status: Error fetching status.';
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

// Funkcija za postavke printera (bez postavke brzine ventilatora)
function setSettings() {
    const printerId = document.getElementById('printer-select').value;
    const nozzleTemp = document.getElementById('nozzle-temp').value;
    const bedTemp = document.getElementById('bed-temp').value;

    sendGcode(printerId, `M104 S${nozzleTemp}`);  // Postavi temperaturu mlaznice
    sendGcode(printerId, `M140 S${bedTemp}`);     // Postavi temperaturu podloge
}

// Funkcija za postavljanje brzine ventilatora
function setFanSpeed() {
    const printerId = document.getElementById('printer-select').value;
    const fanSpeed = document.getElementById('fan-speed').value;

    sendGcode(printerId, `M106 S${fanSpeed}`);    // Postavi brzinu ventilatora
    addNotification(printerId, 'Fan speed set');
}

// Funkcija za pomicanje osi
function moveAxis(axis) {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, `G1 ${axis.toUpperCase()}10 F3000`);
}

// Funkcija za automatsko pozicioniranje osi
function autoHome() {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, 'G28');
}

// Funkcija za XYZ kalibraciju
function calibrateXYZ() {
    const printerId = document.getElementById('printer-select').value;
    sendGcode(printerId, 'G29');
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

// Function to display status updates in the UI
function updateStatusDisplay(printerId, status) {
    const statusElement = document.getElementById(`status-${printerId}`);
    statusElement.innerHTML = `
        <strong>${printerId.replace('_', ' ').toUpperCase()}:</strong>
        <br><strong>Print Status:</strong> ${status.print_status}
        <br><strong>Hotend Temperature:</strong> ${status.hotend_temp || 'N/A'} °C
        <br><strong>Bed Temperature:</strong> ${status.bed_temp || 'N/A'} °C
    `;
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
/*
 // Function to fetch printer status and update the Control Panel
 function updateControlPanel() {
    const printerIds = ['prusa_mk2s_1', 'prusa_mk2s_4', 'prusa_mk2s_5']; // Add your printer IDs here
    const controlPanelContainer = document.getElementById('control-panel-container');
    controlPanelContainer.innerHTML = ''; // Clear the control panel container

    printerIds.forEach(printerId => {
        // Create a printer card for each printer
        const printerCard = document.createElement('div');
        printerCard.classList.add('printer-card');
        printerCard.id = `printer-card-${printerId}`;

        // Add a placeholder message until status is fetched
        printerCard.innerHTML = `<h3>${printerId.toUpperCase().replace('_', ' ')}:</h3><p>Loading status...</p>`;
        controlPanelContainer.appendChild(printerCard);

        // Fetch the printer status
        fetch('/api/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ printer_id: printerId }),
        })
        .then(response => response.json())
        .then(data => {
            const printerStatus = data.response;
            if (printerStatus.error) {
                // Printer not found or disconnected
                printerCard.innerHTML = `
                    <h3>${printerId.toUpperCase().replace('_', ' ')}:</h3>
                    <p>Printer not found or disconnected</p>
                `;
            } else {
                // Display the printer's status
                printerCard.innerHTML = `
                    <h3>${printerId.toUpperCase().replace('_', ' ')}:</h3>
                    <p><strong>Print Status:</strong> ${printerStatus.print_status || 'N/A'}</p>
                    <p><strong>Temperature:</strong> ${printerStatus.temperature_status || 'N/A'}</p>
                `;
            }
        })
        .catch(error => {
            console.error(`Error fetching status for ${printerId}:`, error);
            printerCard.innerHTML = `
                <h3>${printerId.toUpperCase().replace('_', ' ')}:</h3>
                <p>Error fetching status</p>
            `;
        });
    });
}// Continuously refresh the control panel every 1000ms (1 second)
setInterval(updateControlPanel, 5000);
*/
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
                     <small>The hotend nozzle must be over 200°C to enable these buttons.</small>
                    </p>                
    </div>
            </div>
        `;
        controlPanelContainer.appendChild(printerCard);

        // Fetch and update the printer status
        fetchPrinterStatus(printerId);
    });
}


let selectedFileNames = {};  // Globalna varijabla za pohranu odabranih fajlova po printeru

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
    const selectedFile = document.getElementById(`file-name-display-${printerId}`).textContent;
    if (selectedFile === 'No file selected') {
        alert('Please select a file first.');
        return;
    }

    sendGcode([printerId], `M23 ${selectedFile}`);
    sendGcode([printerId], 'M24');
    addNotification(printerId, `Print started for file: ${selectedFile}`);
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

            statusElement.innerHTML = `
                <h3>${printerId.replace('_', ' ').toUpperCase()}</h3>
                <p>Print Status: ${printerStatus.print_status || 'N/A'}</p>
                <p>Hotend Temp: ${hotendTemp} °C | Bed Temp: ${printerStatus.bed_temp || 'N/A'} °C</p>
            `;

            // Enable/disable Load/Unload filament buttons based on hotend temperature
            if (hotendTemp !== 'N/A' && parseFloat(hotendTemp) > 200) {
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
        document.getElementById(`load-filament-${printerId}`).disabled = true;
        document.getElementById(`unload-filament-${printerId}`).disabled = true;
    });
}

// Periodically monitor printer status every 5 seconds
setInterval(() => {
    printerIds.forEach(printerId => {
        fetchPrinterStatus(printerId); // Proveri status za svaki printer u listi
    });
}, 5000);



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

function pausePrint(printerId) {
    sendGcode(printerId, 'M25');  // Pause print
}

function resumePrint(printerId) {
    sendGcode(printerId, 'M24');  // Resume print
}

function cancelPrint(printerId) {
    sendGcode(printerId, 'M26');  // Cancel print
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
