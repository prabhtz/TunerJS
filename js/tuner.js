(function() {
	
var audioContext = null;
var source = null;
var analyser = null;
var audioElement = document.getElementById("audio");
var btn = document.getElementsByClassName("svg-wrapper")[0];
var bufferlength = 1024;
var buf = new Float32Array(bufferlength);
var input = document.getElementById("textBox");
var chordElement = document.getElementById("chord");
var freqElement = document.getElementById("frequency");
var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");

var barContainer = document.getElementById("barcontainer");
var frequencyData;

var svg = document.getElementById("svg");
var svgns = "http://www.w3.org/2000/svg"; 

var line = document.createElementNS(svgns,"line");
var animateTransform = document.createElementNS(svgns, "animateTransform");
var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var notesArray = [];
var guitarnotes;
var lastSlope = 0;
var previousResult = 0;
var current = 0;
var frameID;


window.onload = function() {
	audioContext = new AudioContext();
	analyser = audioContext.createAnalyser();
	drawCircle();
	guitarnotes = new GuitarNotes();
	detectFrequency();
}


btn.onclick = function() {
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

	if (navigator.getUserMedia) {
		navigator.getUserMedia({audio: "true"}, listen, function() {});
	}
}

function listen(stream) {
	source = audioContext.createMediaStreamSource(stream);
	analyser.fftSize = 2048;
	source.connect(analyser);
	// created problems as is mixed with input
	// analyser.connect(audioContext.destination);
	detectFrequency();
	
}
// for analysing from input source in the audio tag


// audioElement.addEventListener(("canplay"), function() {
// 	audioContext = new AudioContext();
// 	source = audioContext.createMediaElementSource(audio);

// 	analyser = audioContext.createAnalyser();

// 	analyser.fftSize = 2048;

// 	source.connect(analyser);
// 	analyser.connect(audioContext.destination);


// });

function detectFrequency() {
	analyser.getFloatTimeDomainData(buf);
	
	frequencyData = new Uint8Array(analyser.frequencyBinCount);
	analyser.getByteFrequencyData(frequencyData);
	console.log(frequencyData);
	displayBar(frequencyData);



	frameID = window.requestAnimationFrame(detectFrequency);
	// var result = calculateCorrelation(buf, audioContext.sampleRate);

	// if (result == -1) {
	// 	chordElement.innerHTML = "--";
	// 	freqElement.innerHTML = "--";
	// } else {
	// 	if (Math.round(result) != Math.round(previousResult)) {
	// 		previousResult = result;
	// 		var note = guitarnotes.getNotes(result);
	// 		var index = note % 12;
	// 		chordElement.innerHTML = notes[index];

	// 		var f = guitarnotes.getFrequency(note);
	// 		freqElement.innerHTML = f.toFixed(3)+ " Hz";
		
	// 		// cancelAnimationFrame(frameID);
	// 		calculateRotation(index);
			
	// 	}
	// }

}

function GuitarNotes() {

	this.x;
	this.y;
	this.theta;

	this.getNotes = function(frequency) {
		var note = 12 * (Math.log(frequency / 440) / Math.LN2);
		return Math.round(note) + 69;
	}

	this.getFrequency = function(note) {
		var freq = 440 * Math.pow(2, (note-69) / 12);
		return freq;
	}

	this.calcSlope = function() {
		var slope = ((this.y - 250) / (this.x - 250));
		var temp = Math.atan(slope) * 180 / Math.PI;

		if(this.x < 250 && this.y > 250) {
			this.theta = 180 + temp;
		} else if (this.x < 250 && this.y < 250) {
			this.theta = 180 + temp;
		} else if(this.x > 250 && this.y < 250) {
			this.theta = 360 + temp;
		} else {
			this.theta = temp;
		}

	}
}

function calculateCorrelation(buf, samplerate) {
	var size = buf.length;
	var maxsamples = Math.floor(size/2);
	
	var rms = 0;
	var bestcorrelation = 0;
	var bestoffset = -1;
	var lastcorrelation = 1;
	var flag = false;
	var correlations = new Array(maxsamples);
	

	for (var i=0; i<size; i++) {
		var temp = buf[i];
		rms += temp * temp;
	}

	rms = Math.sqrt(rms/size);
	
	if (rms<0.01) {
		return -1;
	}


	for (var offset = 0; offset<maxsamples; offset++) {
		var correlation = 0;

		for (var i=0; i<maxsamples; i++) {
			correlation += Math.abs((buf[i]) - (buf[i+offset]));
		}

		correlation = 1 - (correlation/maxsamples);

		correlations[offset] = correlation;
		if (correlation > 0.9 && correlation > lastcorrelation) {
			flag = true;
			if (correlation > bestcorrelation) {
				bestcorrelation = correlation;
				bestoffset = offset;
			
			}
			// } else if (flag) {
			// 	var shift = (correlations[bestoffset + 1] - correlations[bestoffset - 1])/correlations[bestoffset];
			// 	return samplerate/(bestoffset + (8*shift));
			// }
		}

		lastcorrelation = correlation;

		// if (bestcorrelation > 1.3) {
		// 	break;
		// }

	}

	if (bestcorrelation > 0.01) {
		var fundamentalFrequency = samplerate / bestoffset;
		return fundamentalFrequency;
	}
	return -1;
	
}

function drawCircle() {
	
	var circle = document.createElementNS(svgns,"circle");
	circle.setAttributeNS(null,"cx","250");
	circle.setAttributeNS(null,"cy","250");
	circle.setAttributeNS(null,"r","150");
	circle.setAttributeNS(null,"fill","none");
	circle.setAttributeNS(null,"stroke","none");

	svg.appendChild(circle);
	drawLine();
	drawText();
	
}



function drawLine() {
	line.setAttributeNS(null, "id", "line")
	line.setAttributeNS(null, "x1", "250");
	line.setAttributeNS(null, "y1", "250");
	line.setAttributeNS(null, "x2", "380");
	line.setAttributeNS(null, "y2", "250");
	line.setAttributeNS(null, "stroke", "black");

	svg.appendChild(line);
}

function drawText() {

	for (var i=0, offset=0; i<notes.length; i++, offset+=30) {
		var text = document.createElementNS(svgns,"text");
		guitarnotes = new GuitarNotes();
		guitarnotes.x = 250 + 150 * Math.cos((Math.PI * offset)/180);
		guitarnotes.y = 250 + 150 * Math.sin((Math.PI * offset)/180);
		if (guitarnotes.x < 250) {
			guitarnotes.x -= 10;
		}
		guitarnotes.calcSlope();
		
		notesArray.push(guitarnotes);
		text.setAttributeNS(null, "x", guitarnotes.x);
		text.setAttributeNS(null, "y", guitarnotes.y);
		text.innerHTML = notes[i];

		svg.appendChild(text);
	}

}

function calculateRotation(index) {
	var angle = (Math.abs(notesArray[index].theta) - Math.abs(current));


	angle = current + angle;
	if (angle > 180) {
		angle = angle - 360;
	}

	line.style.transform = "rotate(" + angle + "deg)";
	line.style.transformOrigin = "50% 50%";
	current = notesArray[index].theta;
	
}


function displayBar(frequencyData) {
	var width = canvas.width;
	var height = canvas.height;
	var barWidth = 10;
	var spacing = 2;
	var barHeight;

	context.clearRect(0, 0, width, height);

	var barCount = Math.round(width / (barWidth + spacing));
	var loopStep = Math.floor(frequencyData.length / barCount);

	for (var i=0; i<barCount; i++) {
		barHeight = frequencyData[i * loopStep];
		hue = parseInt(120 * (1 - (barHeight / 255)), 10);
		context.fillStyle = "hsl(" + hue + ",75%,50%";
		context.fillRect(((barWidth + spacing) * i) + (spacing / 2), height, barWidth - spacing, -barHeight);
	}

}

// this.calculateByteData = function(buff) {
// 		var bytes = new Float32Array(buff.length);
// 		var minDecibles = -100;
// 		var maxDecibles = -30;

// 		for (var i=0; i<buff.length; i++) {
// 			bytes[i] = (255 * (buff[i] - minDecibles)) / (maxDecibles - minDecibles);
// 			if (bytes[i] < 0) {
// 				bytes[i] = 0;
// 			} else if (bytes[i] > 255) {
// 				bytes[i] = 255;
// 			} else {
// 				bytes[i] = bytes[i];
// 			}
// 		}

// 		views.displayBar(bytes);
// 	}
// 	
// 	
// 	btn.onclick = function() {

		// 	if (listen) { 
		// 		that.input.disconnect(that.scriptNode);
		// 		that.input = null;
		// 		listen = false;
		// 		btnText.innerHTML = "START";
		// 	} else {
		// 		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
		// 		if (navigator.getUserMedia) {
		// 			navigator.getUserMedia({audio: "true"}, function(stream) {

		// 				that.input = that.audioContext.createMediaStreamSource(stream);
		// 				that.input.connect(that.scriptNode);
		// 			}, function() {});
		// 		}
		// 		console.log("listening");
		// 		listen = true;
		// 		btnText.innerHTML = "STOP"
		// 	}
		// }

})();