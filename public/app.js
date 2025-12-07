let audioContext;
try {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
  alert("Web Audio API not supported in this browser");
}

const audioBuffers = {};

const audioNames = {
  kick: "assets/kick.mp3",
  snare: "assets/snare.mp3",
  hi_hat: "assets/hi_hat.mp3",
  clap: "assets/clap.mp3",
  tom: "assets/tom.mp3",
  rattle: "assets/rattle.mp3",
};

const sequencerContainer = document.getElementById("sequencer-container");
const playButton = document.getElementById("play-button");
const bpmInput = document.getElementById("bpm");
const shareButton = document.getElementById("share-button");
const dj = document.getElementById("dj");

const instruments = [
  { label: "Kick", value: "kick" },
  { label: "Snare", value: "snare" },
  { label: "Hi-Hat", value: "hi_hat" },
  { label: "Clap", value: "clap" },
  { label: "Tom", value: "tom" },
  { label: "Rattle", value: "rattle" },
];

let current16th = 0;
let nextNoteTime = 0;
let playing = false;
let intervalId = null;

const interval = 25;

window.onload = async () => {
  playButton.disabled = true;
  shareButton.disabled = true;
  await loadAudioBuffers();
  playButton.disabled = false;
  shareButton.disabled = false;
  const sequencer = document.getElementById("sequencer");
  instruments.forEach((instrument) => {
    sequencer.appendChild(createSequencerRow(instrument));
  });
  createSonglist();
  loadPatternFromURL();
};

async function loadAudioBuffers() {
  for (let instrument of instruments) {
    try {
      const response = await fetch(audioNames[instrument.value]);
      if (!response.ok) {
        throw new Error(
          `Failed to load audio file: ${audioNames[instrument.value]} - ${
            response.statusText
          }`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      audioBuffers[instrument.value] = await audioContext.decodeAudioData(
        arrayBuffer
      );
    } catch (error) {
      console.error(`Error loading audio for ${instrument.value}:`, error);
    }
  }
}

// DOM
function createSequencerRow(instrument) {
  const row = document.createElement("div");
  row.classList.add(
    "grid",
    "grid-cols-[auto_1fr]",
    "md:space-x-2",
    "space-x-1",
    "min-w-0",
    "w-full"
  );
  row.id = `sequencer-item-${instrument.value.toLowerCase()}`;
  row.appendChild(createStepName(instrument));
  row.appendChild(createSteps(instrument));
  return row;
}

function createStepName(instrument) {
  const nameDiv = document.createElement("div");
  nameDiv.classList.add(
    "w-[10px]",
    "flex",
    "items-center",
    "justify-center",
    "-rotate-90",
    "whitespace-nowrap"
  );
  nameDiv.textContent = instrument.label;
  return nameDiv;
}

function createSteps(instrument) {
  const stepsContainer = document.createElement("div");
  stepsContainer.classList.add("box-border", "min-w-0");

  const stepsGrid = document.createElement("div");
  stepsGrid.classList.add(
    "grid",
    "grid-cols-[repeat(8,minmax(0,1fr))]",
    "lg:grid-cols-[repeat(16,minmax(0,1fr))]",
    "gap-0",
    "md:gap-1",
    "box-border",
    "beat-steps"
  );
  stepsGrid.setAttribute("data-instrument", instrument.value);

  for (let i = 0; i < 16; i++) {
    const step = document.createElement("div");
    step.classList.add(
      "aspect-square",
      "bg-gray-500",
      "cursor-pointer",
      "shadow-lg",
      "border-gray-400",
      "border-[1px]",
      "hover:bg-gray-300",
      "box-border",
      "transition-all",
      "duration-150",
      "ease-in-out",
      "beat-step"
    );
    if (i % 4 === 0) {
      step.classList.add("bg-gray-700");
    }
    step.setAttribute("data-step", i);
    step.addEventListener("click", () => {
      step.classList.toggle("!bg-green-500");
      step.classList.toggle("active");
    });
    stepsGrid.appendChild(step);
  }

  stepsContainer.appendChild(stepsGrid);
  return stepsContainer;
}

function createSonglist() {
  const songlist = document.getElementById("song-list");
  fetch("assets/songs.json")
    .then((response) => response.json())
    .then((songs) => {
      songs.forEach((song) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = window.location.origin + song.link;
        link.textContent = `${song.title} by ${song.artist}`;
        link.target = "_blank";
        link.classList.add("text-white-600", "hover:underline");
        li.appendChild(link);
        songlist.appendChild(li);
      });
    });
}

//visibility
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden" && playing) {
    stopSequencer();
  }
});

// Seaquencer and playback logic
playButton.addEventListener("click", () => {
  if (!playing) {
    startSequencer();
    dj.classList.remove("hidden");
  } else {
    stopSequencer();
    dj.classList.add("hidden");
  }
});

function startSequencer() {
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  playing = true;
  playButton.textContent = "Stop";
  current16th = 0;
  nextNoteTime = audioContext.currentTime;
  scheduler();
}

function stopSequencer() {
  playing = false;
  playButton.textContent = "Play";
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  clearPlayingHighlight();
}

function scheduler() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    while (nextNoteTime < audioContext.currentTime + 0.1) {
      scheduleNote(current16th, nextNoteTime);
      nextNote();
    }
  }, interval);
}

function nextNote() {
  const secondsPerBeat = 60.0 / (parseInt(bpmInput.value) || 120);
  const sixteenthNoteDuration = secondsPerBeat / 4;
  nextNoteTime += sixteenthNoteDuration;
  current16th = (current16th + 1) % 16;
}

function scheduleNote(beatNumber, time) {
  const stepContainers = document.querySelectorAll(".beat-steps");
  stepContainers.forEach((container) => {
    const instrument = container.getAttribute("data-instrument");
    const step = container.querySelector(`[data-step='${beatNumber}']`);
    if (step.classList.contains("active")) {
      playSound(instrument, time);
    }
  });

  const delay = (time - audioContext.currentTime) * 1000;
  setTimeout(() => {
    highlightStep(beatNumber);
  }, Math.max(0, delay));
}

function playSound(instrument, time) {
  const buffer = audioBuffers[instrument];
  if (buffer) {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(time);
  }
}

function highlightStep(beatNumber) {
  clearPlayingHighlight();
  document
    .querySelectorAll(`.beat-step[data-step='${beatNumber}']`)
    .forEach(function (el) {
      el.classList.add(
        "playing",
        "border-4",
        "border-solid",
        "border-orange-500"
      );
    });
}

function clearPlayingHighlight() {
  document.querySelectorAll(".beat-step.playing").forEach(function (el) {
    el.classList.remove(
      "playing",
      "border-4",
      "border-solid",
      "border-orange-500"
    );
  });
}

// Sharing
function patternToBytes(patternStr) {
  const dec = parseInt(patternStr, 2);
  const hi = (dec >> 8) & 0xff;
  const lo = dec & 0xff;
  return [hi, lo];
}

function bytesToPattern(hi, lo) {
  const dec = (hi << 8) | lo;
  let bin = dec.toString(2);
  return bin.padStart(16, "0");
}

function arrayBufferToBase64(ab) {
  let str = "";
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

shareButton.addEventListener("click", async () => {
  try {
    if (playing) {
      stopSequencer();
    }

    const beatPerMinute = parseInt(bpmInput.value) || 120;
    const data = new Uint8Array(instruments.length * 2);
    let offset = 0;
    for (let instrument of instruments) {
      const container = document.querySelector(
        `.beat-steps[data-instrument='${instrument.value}']`
      );

      if (!container) {
        offset += 2;
        continue;
      }
      let patternStr = "";
      for (let i = 0; i < 16; i++) {
        const step = container.querySelector(`[data-step='${i}']`);
        patternStr += step.classList.contains("active") ? "1" : "0";
      }
      const [hi, lo] = patternToBytes(patternStr);
      data[offset++] = hi;
      data[offset++] = lo;
    }

    const base64 = arrayBufferToBase64(data.buffer);
    const domain = window.location.origin;
    const params = new URLSearchParams({
      bpm: beatPerMinute,
      b: base64,
    });
    const shareURL = `${domain}/?${params.toString()}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareURL);
    } else {
      const tempInput = document.createElement("input");
      tempInput.value = shareURL;
      document.body.appendChild(tempInput);
      tempInput.select();
      tempInput.setSelectionRange(0, 99999);
      document.execCommand("copy");
      document.body.removeChild(tempInput);
    }
    const alertBox = document.getElementById("share-alert");
    alertBox.classList.remove("hidden");
    setTimeout(() => {
      alertBox.classList.add("hidden");
    }, 1500);
  } catch (error) {
    console.error("Error sharing the track:", error);
    const errorAlert = document.getElementById("share-error");
    errorAlert.classList.remove("hidden");
    setTimeout(() => {
      errorAlert.classList.add("hidden");
    }, 1500);
  }
});

//load pattern from URL
function loadPatternFromURL() {
  const params = new URLSearchParams(window.location.search);
  const bpm = params.get("bpm");
  if (bpm) {
    bpmInput.value = isNaN(parseInt(bpm)) ? 120 : parseInt(bpm);
  }
  const b64 = params.get("b");
  if (!b64) return;
  const arrayBuffer = base64ToArrayBuffer(b64);
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length !== instruments.length * 2) {
    return;
  }

  let offset = 0;
  for (let instrument of instruments) {
    const container = document.querySelector(
      `.beat-steps[data-instrument='${instrument.value}']`
    );
    if (!container) {
      offset += 2;
      continue;
    }
    const hi = bytes[offset++];
    const lo = bytes[offset++];
    const patternStr = bytesToPattern(hi, lo);

    for (let i = 0; i < 16; i++) {
      const step = container.querySelector(`[data-step='${i}']`);
      if (!step) continue;
      if (patternStr[i] === "1") {
        step.classList.add("active", "!bg-green-500");
      } else {
        step.classList.remove("active", "!bg-green-500");
      }
    }
  }
}
