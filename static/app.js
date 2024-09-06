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

// Funkcija za dohvaćanje temperature hotenda i omogućavanje kontrole filamenta
function checkHotendTemperature() {
    const printerId = getSelectedPrinter();

    fetch('/api/status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ printer_id: printerId }),
    })
    .then(response => response.json())
    .then(data => {
        const loadFilamentBtn = document.getElementById('load-filament-btn');
        const unloadFilamentBtn = document.getElementById('unload-filament-btn');

        if (data.status === 'success' && data.response.hotend_temp !== null) {
            const hotendTemp = data.response.hotend_temp;
            
            // Check if the hotend temperature is at least 215°C
            if (hotendTemp >= 215) {
                loadFilamentBtn.disabled = false;
                unloadFilamentBtn.disabled = false;
            } else {
                loadFilamentBtn.disabled = true;
                unloadFilamentBtn.disabled = true;
            }
        } else {
            loadFilamentBtn.disabled = true;
            unloadFilamentBtn.disabled = true;
        }
    })
    .catch(error => {
        console.error('Error fetching temperature:', error);
        document.getElementById('printer-status').textContent = `Status: Error fetching status.`;
    });
}

// Poziva se svakih 5 sekundi kako bi provjerili temperaturu hotenda
setInterval(checkHotendTemperature, 1000);

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

// Function to apply cooldown settings to all selected printers
function cooldown() {
    const printerIds = getSelectedPrinters(); // Get selected printers (single or multiple)

    // Send cooldown G-code to all selected printers
    printerIds.forEach(printerId => {
        sendGcode(printerId, 'M104 S0');  // Turn off hotend
        sendGcode(printerId, 'M140 S0');  // Turn off bed
        addNotification(printerId, 'Cooldown initiated (Hotend: 0°C, Bed: 0°C)');
    });
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

// Automatski dohvaćaj status printera svakih 0.5 sekundi
setInterval(getPrinterStatus, 500);

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
}

// Ensure Control Panel updates when the tab is clicked
document.querySelector('.tablinks[onclick="openTab(event, \'ControlPanel\')"]').addEventListener('click', updateControlPanel);

// Fetch printer status from API with delay before fetching next status
function fetchPrinterStatus(printerId) {
    setTimeout(() => {
        fetch('/api/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ printer_id: printerId }),
        })
        .then(response => response.json())
        .then(data => {
            const statusItem = document.getElementById(`status-${printerId}`);
            if (data.status === 'success') {
                const printerStatus = data.response;

                if (printerStatus.error) {
                    statusItem.innerHTML = `<strong>${printerId.replace('_', ' ').toUpperCase()}:</strong> ${printerStatus.error}`;
                } else {
                    // Display both print status and temperature
                    statusItem.innerHTML = `
                        <strong>${printerId.replace('_', ' ').toUpperCase()}:</strong>
                        <br><strong>Print Status:</strong> ${printerStatus.print_status}
                        <br><strong>Hotend Temperature:</strong> ${printerStatus.hotend_temp || 'N/A'} °C
                        <br><strong>Bed Temperature:</strong> ${printerStatus.bed_temp || 'N/A'} °C
                    `;
                }
            }
        })
        .catch(error => {
            const statusItem = document.getElementById(`status-${printerId}`);
            statusItem.innerHTML = `<strong>${printerId.replace('_', ' ').toUpperCase()}:</strong> Error fetching status`;
        });
    }, 2000);  // Adding a delay before the next status fetch
}

// Function to update Control Panel for all printers
function updateControlPanel() {
    const printerIds = ['prusa_mk2s_1', 'prusa_mk2s_4', 'prusa_mk2s_5']; // List of printer IDs
    const controlPanelContainer = document.getElementById('control-panel-container');
    controlPanelContainer.innerHTML = ''; // Clear previous content

    printerIds.forEach(printerId => {
        // Create a status card for each printer
        const printerCard = document.createElement('div');
        printerCard.classList.add('printer-card');
        printerCard.id = `status-${printerId}`;
        printerCard.innerHTML = `<h3>${printerId.replace('_', ' ').toUpperCase()}:</h3>Loading status...`;
        controlPanelContainer.appendChild(printerCard);

        // Fetch and display status
        fetchPrinterStatus(printerId);
    });
}