(function() {


  var analyser = null;
  var guitarNotes;
  var views;
  var tuningPatterns;

  var audioElement = document.getElementById("audio");
  var btn = document.getElementById("button");
  var dropdown = document.getElementsByClassName("dropdown")[0];
  var table = document.getElementsByClassName("table")[0];
  var arrow = document.getElementsByClassName("arrow")[0];
  var pointer = document.getElementById("pointer");
  var btn = document.getElementsByClassName("svg-wrapper")[0];

  var bufferlength = 1024;
  var buf = new Float32Array(bufferlength);
  var frequencyData;
  var input = document.getElementById("textBox");
  var chordElement = document.getElementById("chord");
  var freqElement = document.getElementById("frequency");
  var canvas = document.getElementById("canvas");
  var context = canvas.getContext("2d");
  var btnText = document.getElementsByClassName("text")[0];

  var barContainer = document.getElementById("barcontainer");
  var svg = document.getElementById("svg");
  var svgns = "http://www.w3.org/2000/svg"; 

  var line = document.createElementNS(svgns, "line");
  var animateTransform = document.createElementNS(svgns, "animateTransform");
  var notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var notesArray = [];
  var lastSlope = 0;
  var previousResult = 0;
  var current = 0;
  var frameID;
  var listen = false;


  /**
    * [blackManWindow description]
    * @param  {Integer} size [Represents the size of window; equal to the fft radix]
    * @return {Float32Array} [Window of specified size]
    */
  var blackManWindow = function(size) {
    var win = new Float32Array(size);
    for (var i=0; i<win.length; i++) {
    win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (win.length - 1)) 
        + 0.08 * Math.cos(4 * Math.PI * i / (win.length - 1));
    
    //////////////////////////////////////////////////////////////////////////
    // Hanning Window for testing
    // win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (win.length - 1))); //
    //////////////////////////////////////////////////////////////////////////
    }
    return win;
  }


  window.onload = function() {
    analyser = new Analyser();
    guitarNotes = new GuitarNotes();
    views = new Views();
    tuningPatterns = new TuningPatterns();
    guitarNotes.generateNoteTable();
    views.init();
    analyser.init();
  }

  /**
    * [Custom analyser to handle input processing and update views]
    */
  function Analyser() {
    var that = this;
    this.bufSize = 2048;
    this.audioContext = new AudioContext();
    this.inputStream = new Float32Array(this.bufSize);
    this.fft = new FFT(this.bufSize, this.audioContext.sampleRate);
    this.biquadFilter = new BiquadFilter();

    this.scriptNode = this.audioContext.createScriptProcessor(this.bufSize, 1, 1);

    /**
     * Intializes a low shelf filter.
     * Input parameters are cut-off frequency, quality factor and gain in dB.
     */
    this.biquadFilter.init((100 / this.audioContext.sampleRate), 0.707, 5);
   
    /**
      * [onaudioprocess]
      * @param  {Event handler input} event 
      * Gets the PCM data from the input Channels- 1 in this case.
      * Calls update() to process the obtained array.
      */
    this.scriptNode.onaudioprocess = function(event) {
      var inputData = event.inputBuffer.getChannelData(0);
      that.update(inputData);
    }

    this.scriptNode.connect(this.audioContext.destination);
    this.input = null;
    this.win = blackManWindow(this.bufSize);


    /**
     * Asks for access to microphone.
     * Connects the acquired stream source to the Script Processor Node.
     */
    this.init = function() {
      btn.onclick = function() {
        if (listen) { 
          that.input.disconnect(that.scriptNode);
          that.input = null;
          listen = false;
          btnText.innerHTML = "START";
        } else {
          navigator.getUserMedia = navigator.getUserMedia || 
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia;
          if (navigator.getUserMedia) {
            navigator.getUserMedia({audio: "true"}, function(stream) {
              that.input = that.audioContext.createMediaStreamSource(stream);
              that.input.connect(that.scriptNode);
            }, function() {});
          }
          console.log("listening");
          listen = true;
          btnText.innerHTML = "STOP"
        }
      }
    }
        
    // For test
    //   audioElement.addEventListener(("canplay"), function() {
        
    //    that.input = that.audioContext.createMediaElementSource(audio);
    //    that.input.connect(that.scriptNode);
    //   });
    // }

    /**
     * Called by Script Processor Node when a PCM data is acquired.
     * @param  {Float32Array} inputData [Represents PCM data]
     *
     * Sets inputStream and calculate Correlation.
     * Applys window as required and calls process() of fft to evaluate FFT.
     * Also calls updateView() to update the UI.
     */
    this.update = function(inputData) {
      this.inputStream.set(this.inputStream.subarray(this.bufSize));
      this.inputStream.set(inputData, this.inputStream.length - inputData.length);
      
      var corrResult = this.fft.calculateCorrelation(this.inputStream);

      for (var i=0; i<inputData.length; i++) {
        this.inputStream[i] = this.biquadFilter.process(this.inputStream[i]);
        this.inputStream[i] = this.inputStream[i] * this.win[i];
      }

      this.fft.process(this.inputStream);
      var fftResult = this.computeFrequency();

      views.updateView(corrResult, fftResult, this.fft);
    }

    /**
     * This corrects the response of some external microphones.
     * 
     * @param  {Integer} i [Index of array]
     * @return {Float}   [Corrected response of the result data]
     */
    this.response = function(i) {
      if ((i * (this.audioContext.sampleRate / this.bufSize)) < 1) {
            return ((-1 * 0.06 * (this.audioContext.sampleRate / 
                 this.bufSize) * i) + 13);
      } else {
        return 1.0;
      }
    }

    this.getData = function() {
      return this.fft.result;
    }

    /**
     * Computes the frequency from the result array retured by a getter function.
     **/
    this.computeFrequency = function() {
      var frequencies = this.getData().subarray(0, 500 / 
                (this.audioContext.sampleRate / this.bufSize));

      var frequency = (frequencies.indexOf(getMax(frequencies)) * 
              (this.audioContext.sampleRate / this.bufSize));
      return frequency;
    }

    /**
     * To find the maximum of TypedArray.
     **/
    function getMax(numArray) {
        return Math.max.apply(null, numArray);
    }
  }

  /**
   * Describes a second order linear recursive filter.
   */
  function BiquadFilter() {
    this.a0 = 1.0;
    this.a1 = 0.0;
    this.a2 = 0.0;
    this.b1 = 0.0;
    this.b2 = 0.0;
    this.fc;
    this.q;
    this.gain;
    this.z1 = 0.0;
    this.z2 = 0.0;

    this.process = function(inp) {
      var out = inp * this.a0 + this.z1;
      this.z1 = inp * this.a1 + this.z2 - this.b1 * out;
      this.z2 = inp * this.a2 - this.b2 * out;
      return out;
    }

    this.init = function(fc, q, gain) {
      this.fc = fc;
      this.q = q;
      this.gain = gain;
      this.calculateBiquad();
    }

    /**
     * Calculates the coefficients of the low shelf filter.
     */
    this.calculateBiquad = function() {
      this.norm;
      this.v = Math.pow(10, Math.abs(this.gain) / 20.0);
      this.k = Math.tan(Math.PI * this.fc);

      this.norm = 1 / (1 + Math.sqrt(2) * this.k + this.k * this.k);
      this.a0 = (1 + Math.sqrt(2 * this.v) * this.k + this.v * this.k * this.k) * this.norm;
      this.a1 = 2 * (this.v * this.k * this.k - 1) * this.norm;
      this.a2 = (1 - Math.sqrt(2 * this.v) * this.k + this.v * this.k * this.k) * this.norm;
      this.b1 = 2 * (this.k * this.k - 1) * this.norm;
      this.b2 = (1 - Math.sqrt(2) * this.k + this.k * this.k) * this.norm;
    }
  }


  /**
   * Computes the result and correlation.
   * @param {Interger} bufSize    [Size of buffer]
   * @param {Integer} sampleRate [Sample rate used for sampling input data]
   */
  function FT(bufSize, sampleRate) {
    this.bufferSize = bufSize;
    this.sampleRate = sampleRate;

    this.result = new Float32Array(bufSize / 2);
    this.real = new Float32Array(bufSize);
    this.imag = new Float32Array(bufSize);

    this.peakBand = 0;
    this.peak = 0;

    /**
     * Analyses the FFT output in real, computes the magnitude and stores in result.
     */
    this.calculate = function() {
      var result = this.result;
      var real = this.real;
      var imag = this.imag;
      var total = 2 / this.bufferSize;
      var rval, ival, mag;
      var N = bufSize / 2;

      for (var i=0; i<N; i++) {
        rval = real[i];
        ival = imag[i];
        mag = total * Math.sqrt(rval * rval + ival * ival);

        if (mag > this.peak) {
          this.peakBand = i;
          this.peak = mag;
        }

        result[i] = mag;
      }

    }

    /**
     * Calculates correlation.
     * @param  {Float32Array}    buff       [Array containing PCM input data]
     * @return {Float} fudamentalFrequency [Frequency computed by the computation]
     */
    this.calculateCorrelation = function(buff) {
      var size = buff.length;
      var buffer = new Float32Array(size);
      var maxsamples = Math.floor(size/2);

      for (var i=0; i<size; i++) {
        buffer[i] = buff[i];
      }
      
      var rms = 0;
      var bestcorrelation = 0;
      var bestoffset = -1;
      var lastcorrelation = 1;
      var flag = false;
      var correlations = new Array(maxsamples);

      for (var i=0; i<size; i++) {
        var temp = buffer[i];
        rms += temp * temp;
      }

      rms = Math.sqrt(rms/size);
      
      if (rms<0.01) {
        return -1;
      }


      for (var offset = 0; offset<maxsamples; offset++) {
        var correlation = 0;

        for (var i=0; i<maxsamples; i++) {
          correlation += Math.abs((buffer[i]) - (buffer[i+offset]));
        }

        correlation = 1 - (correlation/maxsamples);

        correlations[offset] = correlation;
        if (correlation > 0.9 && correlation > lastcorrelation) {
          flag = true;
          if (correlation > bestcorrelation) {
            bestcorrelation = correlation;
            bestoffset = offset;
          }
        }

        lastcorrelation = correlation;
      }

      if (bestcorrelation > 0.1) {
        var fundamentalFrequency = sampleRate / bestoffset;
        return fundamentalFrequency;
      }

      return -1;
    }
  }

  /**
   * Handles FFT computation.
   * @param {Integer} bufSize    [Size of the input buffer; Must be a power of 2]
   * @param {[type]} sampleRate [Sample rate used for sampling input data]
   */
  function FFT(bufSize, sampleRate) {
    FT.call(this, bufSize, sampleRate);

    this.bitReverse = new Uint32Array(bufSize);

    var limit = 1;
    var bit = bufSize >> 1;

    /**
     * Bit-reversal stage 
     *
     * Computes the bit reversed index and stores in bitReverse Array
     */
    while (limit < bufSize) {
      for (var i=0; i<limit; i++) {
        this.bitReverse[i + limit] = this.bitReverse[i] + bit;
      }
      limit = limit << 1;
      bit = bit >> 1;
    }

    this.sin = new Float32Array(bufSize);
    this.cos = new Float32Array(bufSize);

    /**
     * Computes sine and cosine table required for calculation.
     */
    for (var i=1; i<bufSize; i++) {
      this.sin[i] = Math.sin(-Math.PI / i);
      this.cos[i] = Math.cos(-Math.PI / i);
    }

    /**
     * Computes the FFT.
     * @param  {FLoat32Array} buffer [Array after applying window function]
     *
     * Stores the result in the real array.
     */
    this.process = function(buffer) {

      var bufSize = this.bufferSize;
      var cos = this.cos;
      var sin = this.sin;
      
      var bitReverse = this.bitReverse;
      var real = this.real;
      var imag = this.imag;
      

      var k = Math.floor(Math.log(bufSize) / Math.LN2);

      //check if k buffersize is a power of 2
      
      var halfSize = 1,
        phaseShiftStepReal,
        phaseShiftStepImag,
        currentPhaseShiftReal,
        currentPhaseShiftImag,
        off,
        tr,
        ti,
        tmpReal,
        i;

      for (var i=0; i<bufSize; i++) {
        real[i] = buffer[bitReverse[i]];
        imag[i] = 0;
      }
      

      // Alternative Method
      // n = real.length;
      // for(var hN = 1; hN * 2 <= n; hN *= 2) {
      //        for (var i = 0; i < n; i += hN * 2) {
      //            for (var j = i; j < i + hN; j++) {
      //                var cos = Math.cos(Math.PI * (j - i) / hN);
      //                var sin = Math.sin(Math.PI * (j - i) / hN);
      //                var tre =  real[j+hN] * cos + imag[j+hN] * sin;
      //                var tim = -real[j+hN] * sin + imag[j+hN] * cos;
      //                real[j + hN] = real[j] - tre; 
      //                imag[j + hN] = imag[j] - tim;
      //                real[j] += tre; 
      //                imag[j] += tim;
      //          }
      //        }
      //    }
    
      while (halfSize < bufSize) {
        phaseShiftStepReal = cos[halfSize];
        phaseShiftStepImag = sin[halfSize];

        currentPhaseShiftReal = 1;
        currentPhaseShiftImag = 0;

        for (var fftStep = 0; fftStep < halfSize; fftStep++) {
          i = fftStep;

          while (i < bufSize) {
            off = i + halfSize;
            tr = (currentPhaseShiftReal * real[off]) - 
               (currentPhaseShiftImag * imag[off]);
            ti = (currentPhaseShiftReal * imag[off]) + 
               (currentPhaseShiftImag * real[off]);

            real[off] = real[i] - tr;
            imag[off] = imag[i] - ti;
            real[i] += tr;
            imag[i] += ti;

            i += halfSize << 1;
          }

          tmpReal = currentPhaseShiftReal;
          currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - 
                      (currentPhaseShiftImag * phaseShiftStepImag);
          currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + 
                      (currentPhaseShiftImag * phaseShiftStepReal);
        }

        halfSize = halfSize << 1;
      }

      var timeConstant = 0.8;
      var previous = new Float32Array(bufSize);

      /**
       * Smooting the FFT result.
       */
      for (var i=0; i<bufSize; i++) {
        real[i] = timeConstant * previous[i] + (1 - timeConstant) * Math.abs(real[i]);
        previous[i] = real[i];
      }

      /**
       * To obtain magnitudes in dB of the computed data.
       */
      this.calculate();

      for (var i=0; i<real.length; i++) {
        real[i] = 20 * Math.log10(real[i]);
      }

      /**
       * Calculate the ByteData required for diplaying bar visualization
       */
      // this.calculateByteData(real);

      var buff = new Float32Array(bufSize);

      //for calculating ifft
      for (var i=0; i<bufSize; i++) {
        buff[i] = real[i] / (bufSize);
      }     
    }

    /**
     * Calculates byte data. 
     * @param  {Float32Array} buff [Result of FFT calculation]
     *
     * Result is clamped in the range of 0-255.
     * Calls displayBar() to display frequency bars.
     */
    this.calculateByteData = function(buff) {
      var bytes = new Uint8Array(buff.length);
      var minDecibles = -100;
      var maxDecibles = -30;

      for (var i=0; i<buff.length; i++) {
        bytes[i] = (255 * (buff[i] - minDecibles)) / (maxDecibles - minDecibles);
        if (bytes[i] < 0) {
          bytes[i] = 0;
        } else if (bytes[i] > 255) {
          bytes[i] = 255;
        } else {
          bytes[i] = bytes[i];
        }
      }
      
      views.displayBar(bytes);
    }
  }

  /**
   * Catalogue of notes for a 12 equal temperament system.
   */
  function GuitarNotes() {
    this.notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    this.x;
    this.y;
    this.theta;

    this.noteTable = {};

    /**
     * Calculates the frequency.
     * @param  {Integer} noteNumber [Value in the noteTable]
     * @return {Float}  freq        [Calculated frequency]
     *
     * Frequencies are calculated with reference frequency of A4 = 440Hz.
     * 69 is the MIDI number of A4.
     */
    this.getFrequency = function(noteNumber) {
      var freq = 440 * Math.pow(2, (noteNumber-69) / 12);
      return freq;
    } 


    /**
     * Calculates note value or MIDI number.
     * @param  {Float} frequency
     * @return {Integer} note [MIDI note number]
     */
    this.getNotesValue = function(frequency) {
      var note = 12 * (Math.log(frequency / 440) / Math.LN2);
      return Math.round(note) + 69;
    }

    /**
     * Placement of notes in a circular fashion.
     */
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

    /**
     * Generates a MIDI note table.
     */
    this.generateNoteTable = function() {
      var index = 0;
      var octave = -1;
      for (var i=0; i<128; i++) {
        this.noteTable[notes[index] + octave] = i;
        index++;
        if (index % 12 == 0) {
          index = 0;
          octave++;
        }
      }
    }

    /**
     * Calculates key(MIDI notation) for a MIDI note number.
     * @param  {Integer} value [Note Number]
     * @return {String}  key   [MIDI notation]
     */
    this.getKey = function(value) {
      for (var key in this.noteTable) {
        if (this.noteTable[key] === value) {
          return key;
        }
      }
      return -1;
    }
  }

  /**
   * Some of the tuning patterns of a 6-string Guitar.
   * The tuning patterns along with string frequencies are calculated
   * and stored in string Array. 
   */
  function TuningPatterns() {
    this.strings = [];
    var freq;

    this.regular = function() {
      this.strings = ["E4", "B3", "G3", "D3", "A2", "E2"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }

    this.irish = function() {
      this.strings = ["D2", "A2", "D3", "G3", "A3", "D4"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }

    this.dropD = function() {
      this.strings = ["D2", "A2", "D3", "G3", "B3", "E4"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }

    this.openD = function() {
      this.strings = ["D2", "A2", "D3", "F#3", "A3", "D4"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }

    this.openG = function() {
      this.strings = ["D2", "G2", "D2", "G2", "B3", "D4"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }

    this.openA = function() {
      this.strings = ["E2", "A2", "E3", "A3", "C#4", "E4"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }

    this.lute = function() {
      this.strings = ["E2", "A2", "D3", "F#3", "B3", "E4"];
      for (var i=0; i<this.strings.length; i++) {
        freq = guitarNotes.getFrequency(guitarNotes.noteTable[this.strings[i]]).toFixed(4);
        this.strings[i] = [this.strings[i],freq];
      }
    }
  } 

  /**
   * Contains all the UI views.
   */
  function Views() {
    this.finalFrequency = 0;
    var notesArray = [];
    var active = {};
    var currentSelection = 0;
    var dataArray = [];
    var thead;
    var tr;
    var th;
    var text;
    var tbody;

    this.init = function() {
      drawCircle();
      drawLine();
      drawText();
      createTable();
    }

    /**
     * Displays the computed note and frequency.
     * @param  {Float} corrResult [Result of correlation]
     * @param  {Float} fftResult  [Result of FFT]
     *
     * Both are compared to provide a good approximate.
     * Correlation gives accurate results below 250 Hz, while FFT above 250 Hz.
     */
    this.updateView = function(corrResult, fftResult, fftObj) {
      context.clearRect(0, 0, canvas.width, canvas.height);  

      if (corrResult == -1) {
        chordElement.innerHTML = "--";
        freqElement.innerHTML= "0" + "<br/>Hz";
      } else {

        if (Math.abs(corrResult - fftResult) > 10) {
          this.finalFrequency = corrResult;

        } else if (Math.abs(corrResult - fftResult) <= 10) {
          if (corrResult < fftResult) {
            fftResult -= (fftResult - corrResult);
          } else {
            fftResult += (corrResult - fftResult);
          }
          this.finalFrequency = (corrResult + fftResult) / 2;
        } else {
          this.finalFrequency = -1;
        }
        
        var value = guitarNotes.getNotesValue(this.finalFrequency);
        var display = guitarNotes.getKey(value);
        var notesIndex = value % 12;
        
        chordElement.innerHTML = display;
        freqElement.innerHTML = this.finalFrequency.toFixed(0) + "<br/>Hz";

        fftObj.calculateByteData(fftObj.real);
        calculateRotation(notesIndex);
        this.displayArrow(value, display);
      }
    }

    function drawCircle() {
      
      var circle = document.createElementNS(svgns,"circle");
      circle.setAttributeNS(null,"cx","250");
      circle.setAttributeNS(null,"cy","250");
      circle.setAttributeNS(null,"r","150");
      circle.setAttributeNS(null,"fill","none");
      circle.setAttributeNS(null,"stroke","none");

      svg.appendChild(circle);
    }

    function drawLine() {
      line.setAttributeNS(null, "id", "line")
      line.setAttributeNS(null, "x1", "250");
      line.setAttributeNS(null, "y1", "250");
      line.setAttributeNS(null, "x2", "380");
      line.setAttributeNS(null, "y2", "250");
      line.setAttributeNS(null, "stroke", "#b3b6be");
      line.setAttributeNS(null, "marker-end", "url(#pointer)");

      svg.appendChild(line);
    }

    function drawText() {

      for (var i=0, offset=0; i<notes.length; i++, offset+=30) {
        var text = document.createElementNS(svgns,"text");
        var guitarnotes = new GuitarNotes();
        guitarnotes.x = 250 + 150 * Math.cos((Math.PI * offset)/180);
        guitarnotes.y = 250 + 150 * Math.sin((Math.PI * offset)/180);

        if (guitarnotes.x < 250) {
          guitarnotes.x -= 10;
        }

        guitarnotes.calcSlope();
        notesArray.push(guitarnotes);
        text.setAttributeNS(null, "x", guitarnotes.x);
        text.setAttributeNS(null, "y", guitarnotes.y);
        text.setAttributeNS(null, "fill", "#c8ccd0");
        text.innerHTML = notes[i];

        svg.appendChild(text);
      }
    }

    /**
     * Calulates the rotation of pointer inside the circle.
     * @param  {Integer} index [Position of note in the notes array]
     */
    function calculateRotation(index) {
      var angle = (Math.abs(notesArray[index].theta) - Math.abs(current));

      angle = current + angle;
      if (angle > 180) {
        angle = angle - 360;
      }

      line.style.transform = "rotate(" + angle + "deg)";
      current = notesArray[index].theta;
      
    }

    /**
     * Displays Up or Down arrow to indicate whether the computed frequency
     * is above or below the selected tuning pattern.
     * @param  {Integer} value   [MIDI value]
     * @param  {String} display [MIDI note number]
     */
    this.displayArrow = function(value, display) {
      var difference;
      var position = 0;
      var minDifference = 1000;
      var intervalId;
      if (currentSelection != 0) {
        for (var i=0; i<tuningPatterns.strings.length; i++) {
          difference = Math.abs(this.finalFrequency - 
                 parseFloat(tuningPatterns.strings[i][1]));
          if (minDifference > difference) {
            minDifference = difference;
            position = i;
          }
        }
        
        if (minDifference > 3.0000) {
          if (this.finalFrequency < parseFloat(tuningPatterns.strings[position][1])) {
            arrow.classList.remove("down");
            arrow.classList.add("up");
          } else {
            arrow.classList.remove("up");
            arrow.classList.add("down");
          }
        }

        if (minDifference <=3.0000) {
          arrow.classList.remove("up");
          arrow.classList.remove("down");

        }
      }
    }

    /**
     * Displays frequency byte data in bars.
     * @param  {Uint8Array} frequencyData [Byte data clamped in the range 0-255]
     */
    this.displayBar = function(frequencyData) {
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
        context.fillRect(((barWidth + spacing) * i) + (spacing / 2), height,
                 barWidth - spacing, -barHeight);
      }
    }

    /**
     * Handle the dropdown button click.
     */
    dropdown.addEventListener("click", function(event) {
      if (event.target.tagName == "LI") {
        active.button.innerHTML = event.target.innerHTML;
        currentSelection = event.target.id;
        updateTable();
      }
      for (var i=0; i<dropdown.children.length; i++) {
        if (dropdown.children[i].classList.contains("dropdown-selection")) {
          active.element = dropdown.children[i];
          dropdown.children[i].style.visibility = "visible";
        } else if (dropdown.children[i].classList.contains("dropdown-button")) {
          active.button = dropdown.children[i];
        }
      } 
    });

    window.onclick = function(event) {
      if (!event.target.classList.contains("dropdown-button")) {
        active.element.style.visibility = "hidden";
      }
    }

    /**
     * Creates a table to display the selected tuning pattern.
     */
    function createTable() {
      thead = document.createElement("thead");
      tr = document.createElement("tr");
      th = document.createElement("th");
      text = document.createTextNode("Strings (From 1 to 6)");
      tbody = document.createElement("tbody");

      th.appendChild(text);
      tr.appendChild(th);
      thead.appendChild(tr);
      table.appendChild(thead);

      th = document.createElement("th");
      text = document.createTextNode("Frequencies (Click to Play)");
      th.appendChild(text);
      tr.appendChild(th);
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    /**
     * Dynamically update the table body according to the selected tuning pattern.
     */
    function updateTable() {
      tbody.innerHTML = "";
      switch (currentSelection) {

        case "1":
          tuningPatterns.regular();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        case "2":
          tuningPatterns.irish();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);  
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        case "3":
          tuningPatterns.dropD();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        case "4":
          tuningPatterns.openD();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);  
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        case "5":
          tuningPatterns.openG();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);  
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        case "6":
          tuningPatterns.openA();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);  
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        case "7":
          tuningPatterns.lute();
          for (var i=0; i<tuningPatterns.strings.length; i++) {
            var tr = document.createElement("tr");
            for (var j=0; j<tuningPatterns.strings[i].length; j++) {
              var td = document.createElement("td");
              td.innerHTML = tuningPatterns.strings[i][j];
              if (j == tuningPatterns.strings[i].length - 1) {
                td.style.cursor = "pointer";
                td.onclick = function(event) {
                  playSound(event.target.innerHTML);  
                }
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          break;

        default:
          break;
      }
    }

    /**
     * Play a sample sound of selected frequency.
     * @param  {String} num [Clicked frequency in the table]
     */
    function playSound(num) {
      var num = parseFloat(num);
      var playContext = new AudioContext();
      var oscillator = playContext.createOscillator();
      var gain = playContext.createGain();
      var time = 3;
      gain.gain.value = 1.0;
      oscillator.frequency.value = num;
      oscillator.connect(gain);
      gain.connect(playContext.destination);
      oscillator.start();
      oscillator.stop(playContext.currentTime + 2);
    }
  }
})();