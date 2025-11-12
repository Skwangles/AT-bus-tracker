// Application state
const state = {
    video: null,
    data: [],
    userDefined: [],
    disableLoop: [],
    loopDetectionEnabled: true,
    areaNames: new Set(), // For autocomplete suggestions
    timeUpdateInterval: null
};

// DOM elements
const videoPlayer = document.getElementById('videoPlayer');
const videoPathInput = document.getElementById('videoPath');
const loadPathBtn = document.getElementById('loadPathBtn');
const dropZone = document.getElementById('dropZone');
const videoSection = document.getElementById('videoSection');
const controlsSection = document.getElementById('controlsSection');
const annotationsSection = document.getElementById('annotationsSection');
const currentTimeDisplay = document.getElementById('currentTime');
const addAreaBtn = document.getElementById('addAreaBtn');
const addMarkerBtn = document.getElementById('addMarkerBtn');
const toggleLoopBtn = document.getElementById('toggleLoopBtn');
const loopStatus = document.getElementById('loopStatus');
const downloadBtn = document.getElementById('downloadBtn');

// Modal elements
const addAreaModal = new bootstrap.Modal(document.getElementById('addAreaModal'));
const addMarkerModal = new bootstrap.Modal(document.getElementById('addMarkerModal'));
const areaNameInput = document.getElementById('areaName');
const areaSuggestions = document.getElementById('areaSuggestions');
const submitAreaBtn = document.getElementById('submitAreaBtn');
const markerTypeSelect = document.getElementById('markerType');
const descriptionField = document.getElementById('descriptionField');
const descriptionInput = document.getElementById('description');
const elevatorShaftField = document.getElementById('elevatorShaftField');
const elevatorShaftInput = document.getElementById('elevatorShaft');
const markerInfoInput = document.getElementById('markerInfo');
const submitMarkerBtn = document.getElementById('submitMarkerBtn');

// Initialise video player
state.video = videoPlayer;

// Video loading functions
function loadVideoFromFile(file) {
    const url = URL.createObjectURL(file);
    videoPlayer.src = url;
    videoSection.style.display = 'block';
    controlsSection.style.display = 'block';
    annotationsSection.style.display = 'block';
    startTimeTracking();
}

function loadVideoFromPath(path) {
    // Note: Due to browser security, loading from arbitrary file paths may not work
    // This is a limitation of web browsers. Users should use drag-and-drop instead.
    if (path && path.trim() !== '') {
        try {
            videoPlayer.src = path;
            videoSection.style.display = 'block';
            controlsSection.style.display = 'block';
            annotationsSection.style.display = 'block';
            startTimeTracking();
        } catch (error) {
            alert('Unable to load video from path. Please use drag-and-drop instead.');
            console.error('Error loading video:', error);
        }
    }
}

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('video/')) {
            loadVideoFromFile(file);
        } else {
            alert('Please drop a video file.');
        }
    }
});

// Path input handler
loadPathBtn.addEventListener('click', () => {
    const path = videoPathInput.value.trim();
    if (path) {
        loadVideoFromPath(path);
    } else {
        alert('Please enter a video file path.');
    }
});

videoPathInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loadPathBtn.click();
    }
});

// Time tracking
function startTimeTracking() {
    if (state.timeUpdateInterval) {
        clearInterval(state.timeUpdateInterval);
    }
    
    state.timeUpdateInterval = setInterval(() => {
        if (videoPlayer && !videoPlayer.paused) {
            const currentTime = Math.floor(videoPlayer.currentTime * 1000);
            currentTimeDisplay.textContent = currentTime;
        }
    }, 10); // Update every 10ms for smooth display
    
    videoPlayer.addEventListener('timeupdate', () => {
        const currentTime = Math.floor(videoPlayer.currentTime * 1000);
        currentTimeDisplay.textContent = currentTime;
    });
}

// Get current time in milliseconds
function getCurrentTime() {
    return Math.floor(videoPlayer.currentTime * 1000);
}

// Add Area functionality
addAreaBtn.addEventListener('click', () => {
    if (!videoPlayer.src) {
        alert('Please load a video first.');
        return;
    }
    
    // Pause video
    videoPlayer.pause();
    
    // Update autocomplete suggestions
    updateAreaSuggestions();
    
    // Clear and show modal
    areaNameInput.value = '';
    addAreaModal.show();
});

submitAreaBtn.addEventListener('click', () => {
    const areaName = areaNameInput.value.trim();
    if (!areaName) {
        alert('Please enter an area name.');
        return;
    }
    
    const currentTime = getCurrentTime();
    state.data.push({
        g: areaName,
        t: currentTime
    });
    
    // Add to area names set for autocomplete
    state.areaNames.add(areaName);
    
    // Update UI
    updateDataList();
    addAreaModal.hide();
    
    // Resume video playback
    videoPlayer.play();
});

// Update area suggestions for autocomplete
function updateAreaSuggestions() {
    areaSuggestions.innerHTML = '';
    state.areaNames.forEach(areaName => {
        const option = document.createElement('option');
        option.value = areaName;
        areaSuggestions.appendChild(option);
    });
}

// Add Marker functionality
addMarkerBtn.addEventListener('click', () => {
    if (!videoPlayer.src) {
        alert('Please load a video first.');
        return;
    }
    
    // Reset form
    markerTypeSelect.value = 'regular';
    descriptionInput.value = '';
    elevatorShaftInput.value = '';
    markerInfoInput.value = '';
    updateMarkerFormFields();
    
    addMarkerModal.show();
});

// Update marker form fields based on type
markerTypeSelect.addEventListener('change', updateMarkerFormFields);

function updateMarkerFormFields() {
    const type = markerTypeSelect.value;
    
    if (type === 'anchor') {
        descriptionField.style.display = 'none';
        elevatorShaftField.style.display = 'none';
        descriptionInput.required = false;
        elevatorShaftInput.required = false;
    } else if (type === 'elevator') {
        descriptionField.style.display = 'block';
        elevatorShaftField.style.display = 'block';
        descriptionInput.required = true;
        elevatorShaftInput.required = true;
    } else {
        descriptionField.style.display = 'block';
        elevatorShaftField.style.display = 'none';
        descriptionInput.required = type === 'toilet';
        elevatorShaftInput.required = false;
    }
}

submitMarkerBtn.addEventListener('click', () => {
    const type = markerTypeSelect.value;
    const currentTime = getCurrentTime();
    let markerText = '';
    const markerEntry = {
        t: currentTime
    };
    
    if (type === 'anchor') {
        markerText = '!!anchor';
        markerEntry.g = markerText;
    } else if (type === 'toilet') {
        const description = descriptionInput.value.trim();
        if (!description) {
            alert('Please enter a description for the toilet.');
            return;
        }
        markerText = `!!toilet, ${description}`;
        markerEntry.g = markerText;
    } else if (type === 'elevator') {
        const shaft = elevatorShaftInput.value.trim();
        const description = descriptionInput.value.trim();
        if (!shaft || !description) {
            alert('Please enter both elevator shaft group name and description.');
            return;
        }
        markerText = `!!elevator, ${shaft}, ${description}`;
        markerEntry.g = markerText;
    } else {
        // Regular point of interest
        const description = descriptionInput.value.trim();
        if (!description) {
            alert('Please enter a description.');
            return;
        }
        markerText = description;
        markerEntry.g = markerText;
    }
    
    // Add optional info field
    const info = markerInfoInput.value.trim();
    if (info) {
        markerEntry.info = info;
    }
    
    state.userDefined.push(markerEntry);
    updateUserDefinedList();
    addMarkerModal.hide();
});

// Loop detection toggle
toggleLoopBtn.addEventListener('click', () => {
    if (!videoPlayer.src) {
        alert('Please load a video first.');
        return;
    }
    
    const currentTime = getCurrentTime();
    state.loopDetectionEnabled = !state.loopDetectionEnabled;
    
    state.disableLoop.push({
        disable: !state.loopDetectionEnabled,
        t: currentTime
    });
    
    // Update UI
    loopStatus.textContent = state.loopDetectionEnabled ? 'Enabled' : 'Disabled';
    toggleLoopBtn.classList.toggle('btn-warning', state.loopDetectionEnabled);
    toggleLoopBtn.classList.toggle('btn-danger', !state.loopDetectionEnabled);
    updateLoopList();
});

// Update display lists
function updateDataList() {
    const list = document.getElementById('dataList');
    const count = document.getElementById('dataCount');
    
    list.innerHTML = '';
    count.textContent = state.data.length;
    
    state.data.forEach((item, index) => {
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${item.g}</strong></span>
                <small>${item.t} ms</small>
            </div>
        `;
        list.appendChild(listItem);
    });
}

function updateUserDefinedList() {
    const list = document.getElementById('userDefinedList');
    const count = document.getElementById('userDefinedCount');
    
    list.innerHTML = '';
    count.textContent = state.userDefined.length;
    
    state.userDefined.forEach((item, index) => {
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item';
        const infoText = item.info ? `<br><small class="text-muted">Info: ${item.info}</small>` : '';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${item.g}</strong>${infoText}</span>
                <small>${item.t} ms</small>
            </div>
        `;
        list.appendChild(listItem);
    });
}

function updateLoopList() {
    const list = document.getElementById('loopList');
    const count = document.getElementById('loopCount');
    
    list.innerHTML = '';
    count.textContent = state.disableLoop.length;
    
    state.disableLoop.forEach((item, index) => {
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item';
        const statusClass = item.disable ? 'text-danger' : 'text-success';
        const statusText = item.disable ? 'Disabled' : 'Enabled';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between">
                <span class="${statusClass}"><strong>${statusText}</strong></span>
                <small>${item.t} ms</small>
            </div>
        `;
        list.appendChild(listItem);
    });
}

// JSON export
downloadBtn.addEventListener('click', () => {
    const jsonData = {
        data: state.data,
        user_defined: state.userDefined,
        disable_loop: state.disableLoop
    };
    
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Initialise marker form fields
updateMarkerFormFields();

