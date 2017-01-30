(function() {

function Fft() {
	var n, m;

	var cos;
	var sin;

	var win;

	this.init = function(radix) {
		n = radix;
		m = parseInt((Math.log(n)) / Math.LN2);

		if (n != (1<<m)) {
			console.log("not a power of 2");
		}

		cos = new Array(n/2);
		sin = new Array(n/2);

		for (var i=0; i<n/2; i++) {
			cos[i] = Math.cos(-2 * Math.PI * i/n);
			sin[i] = Math.sin(-2 * Math.PI * i/n);
		}

		
		makeWindow();
	} 

	function makeWindow() {
		win = new Float32Array(n);
		for (var i=0; i<win.length; i++) {
			win[i] = 0.42 - 0.5 * Math.cos(2*Math.PI*i/(n-1)) + 0.08 * Math.cos(4*Math.PI*i/(n-1));
		}
	}

	this.returnWindow = function() {
		return win;
	}

	this.calcFFT = function(x, y) {
		var n1,n2,a,c,s,e,t1,t2;
		var n = x.length;

		var temp;
		var flips = {};

		for (var i=0; i<n; i++) {
			var ri = bitReverse(i, n);

			if (flips.hasOwnProperty(i) || flips.hasOwnProperty(ri)) {
				continue;
			}

			temp = x[ri];
			x[ri] = x[i];
			x[i] = temp;

			temp = y[ri];
			y[ri] = y[i];
			y[i] = temp;


			flips[i] = flips[ri] = true;
		}

		console.log(x,y);
		// n1 = 0;
		// n2 = 1;

		// for (var i=0; i<m; i++) {
		// 	n1 = n2;
		// 	n2 += n2;
		// 	a = 0;

		// 	for (var j=0; j<n1; j++) {
		// 		c = cos[a];
		// 		s = sin[a];
		// 		a += 1 << (m-i-1);

		// 		console.log(a);

		// 		for (var k=j; k<n; k+=n2) {
		// 			t1 = c * x[k+n1] - s * y[k+n1];
		// 			t2 = s * x[k+n1] - c * y[k+n1];

		// 			x[k+n1] = x[k] - t1;
		// 			y[k+n1] = y[k] - t2;

		// 			x[k] = x[k] + t1;
		// 			y[k] = y[k] + t2;
		// 		}
		// 	}
		// }
		
	    for(var hN = 1; hN * 2 <= n; hN *= 2) {
	        for (var i = 0; i < n; i += hN * 2) {
	            for (var j = i; j < i + hN; j++) {
	                var cos = Math.cos(Math.PI * (j - i) / hN);
	                var sin = Math.sin(Math.PI * (j - i) / hN);
	                var tre =  x[j+hN] * cos + y[j+hN] * sin;
	                var tim = -x[j+hN] * sin + y[j+hN] * cos;
	                x[j + hN] = x[j] - tre; 
	                y[j + hN] = y[j] - tim;
	                x[j] += tre; 
	                y[j] += tim;
	      		}
	      	}
	    }
	}

}


		/////////////
		//         //
		////test 2
		///recursion algorithm //
		/////////////
	

function FFT(input) {

		var n = input.length;

		if (n <= 1) {
			return input;
		}

		
		console.log(typeof(input));

		var m = n/2;
		var even = [];
		var odd = [];
		
		even.length = m;
		odd.length = m;

		for (var i=0; i<m; ++i) {
			even[i] = input[i*2];
			odd[i] = input[i*2+1];
		}

	


		even = FFT(even);
		odd = FFT(odd);
		console.log(even);

		var a = -2 * Math.PI;

		for (var k=0; k<m; ++k) {
			if (!(even[k] instanceof Complex)) {
				even[k] = new Complex(even[k], 0);
			}
			if (!(odd[k] instanceof Complex)) {
				odd[k] = new Complex(odd[k], 0);
			}
			var p = k/n;
			var t = new Complex(0, a*p);
			t.cexp(t).mul(odd[k], t);
			input[k] = even[k].add(t, odd[k]);
			input[k + m] = even[k].sub(t, even[k]);
		}
	return input;
}

function Complex(re, im) {

	this.re = re || 0.0;
	this.im = im || 0.0;

	this.add = function(adder, dest) {
		dest.re = this.re + adder.re;
		dest.im = this.im + adder.im;
		return dest;	
	}

	this.sub = function(adder, dest) {
		dest.re = this.re - adder.re;
		dest.im = this.im - adder.im;
		return dest;	
	}

	this.mul = function(adder, dest) {
		var r = this.re * adder.re - this.im * adder.im;
		dest.im = this.re * adder.im + this.im * adder.re;
		dest.re = r;
		return dest;	
	}

	this.cexp = function(dest) {
		var expor = Math.exp(this.re);
		dest.re = expor * Math.cos(this.im);
		dest.im = expor * Math.sin(this.im);
		return dest;	
	}
}

function blackmanWindow(n) {
	var win = [];
	for (var i=0; i<n; i++) {
		win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i /(n-1)) + 0.08 * Math.cos(4 * Math.PI * i /(n-1));
	}
	return win;
}

var audioContext = new AudioContext();
var audioElement = document.getElementById("audio");
var scriptNode = audioContext.createScriptProcessor(2048, 2, 2);

audioElement.addEventListener(("canplay"), function() {
	source = audioContext.createMediaElementSource(audio);

	console.log(source);
	console.log(scriptNode);

	source.connect(scriptNode);
	scriptNode.connect(audioContext.destination);
	console.log(audioContext.destination);
});

scriptNode.onaudioprocess = processInput;


function processInput(event) {
	var inputBuffer = event.inputBuffer;
	var outputBuffer = event.outputBuffer;

	for (var channel=0; channel<outputBuffer.numberOfChannels; channel++) {	
		var inputData = inputBuffer.getChannelData(channel);
		var outputData = outputBuffer.getChannelData(channel);
		console.log(inputData);
		
		var test = Array.from(inputData);
	
		for (var sample=0; sample<inputBuffer.length; sample++) {
			outputData[sample] = inputData[sample];
		}

		console.log(inputData);
		// calcfft(inputData);

		setTimeout(processInput, 10);
	}
}

function calcfft(input) {
	var im = 0;
	console.log(input);
	fft.calcFFT(input, im);

	// requestAnimationFrame(calcfft);
}

function bitReverse(i, n) {
	var index = 0;
	while (n > 1) {
		index <<= 1;
		index += i & 1;
		i >>= 1;
		n >>= 1;
	}
	return index;
}


var fft = new Fft();
fft.init(2048);


// var re = new Array(8);
// var im = new Array(8);

// re = [1,1,1,1,0,0,0,0];
// im = [0,0,0,0,0,0,0,0];


// console.log("before", re, im);
// fft.calcFFT(re, im);
// var output = new Float32Array(8);

// for (var i=0; i<re.length; i++) {
// 	output[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
// }

// console.log(output);



})();