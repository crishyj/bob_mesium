/*
	PET utilities, Norbert Landsteiner, 2017; www.masswerk.at/pet/
	Contains
	a Basic source to tokenized prg parser,
	a parser for D64 image files,
	a facility to generate BASIC source to print a given snapshot of screen RAM,
	facilities to hex-dump BASIC programs or arbritrary memory ranges
	a 6502 disassembler
*/

"use strict";

var Utils = (function() {

// parse a plain text listing to tokenized BASIC

function txt2Basic(txt, address, asPrgFile, isPetRom1) {
	// normalize arguments
	var src, startAddr;
	switch (Object.prototype.toString.call(txt)) {
		case '[object Array]':
		case '[object Uint8Array]':
			src = txt;
			break;
		case '[object ArrayBuffer]':
			txt = new DataView(txt);
		case '[object DataView]':
			var src = [], size = txt.byteLength;
			for (var i = 0; i < size; i++) src[i] = txt.getUint8(i);
			break;
		case '[object String]':
			var src = [];
			txt = txt.replace(/[“”„«»]/g, '"').replace(/[‘’‹›]/g, '\'');
			for (var i = 0; i < txt.length; i++) {
				if (txt.charAt(i) === 'π' || txt.charAt(i) === '∏') {
					src.push(0xFF);
				}
				else {
					var c = txt.charCodeAt(i);
					if (c <= 0xFF) src.push(c);
				}
			}
			break;
		default:
			return {
				'prg': [],
				'error': 'illegal input: '+Object.prototype.toString.call(txt)+'.'
			};
	}
	// start address defaults to PET
	startAddr = (address && !isNaN(address))?
		Number(address) & 0xFFFF
		: 0x0401;

	// defs and setup
	var	tokens = [
			0x45,0x4E,0xC4, //end
			0x46,0x4F,0xD2, //for
			0x4E,0x45,0x58,0xD4, //next
			0x44,0x41,0x54,0xC1, //data
			0x49,0x4E,0x50,0x55,0x54,0xA3, //input#
			0x49,0x4E,0x50,0x55,0xD4, //input
			0x44,0x49,0xCD, //dim
			0x52,0x45,0x41,0xC4, //read
			0x4C,0x45,0xD4, //let
			0x47,0x4F,0x54,0xCF, //goto
			0x52,0x55,0xCE, //run
			0x49,0xC6, //if
			0x52,0x45,0x53,0x54,0x4F,0x52,0xC5, //restore
			0x47,0x4F,0x53,0x55,0xC2, //gosub
			0x52,0x45,0x54,0x55,0x52,0xCE, //return
			0x52,0x45,0xCD, //rem
			0x53,0x54,0x4F,0xD0, //stop
			0x4F,0xCE, //on
			0x57,0x41,0x49,0xD4, //wait
			0x4C,0x4F,0x41,0xC4, //load
			0x53,0x41,0x56,0xC5, //save
			0x56,0x45,0x52,0x49,0x46,0xD9, //verify
			0x44,0x45,0xC6, //def
			0x50,0x4F,0x4B,0xC5, //poke
			0x50,0x52,0x49,0x4E,0x54,0xA3, //print#
			0x50,0x52,0x49,0x4E,0xD4, //print
			0x43,0x4F,0x4E,0xD4, //cont
			0x4C,0x49,0x53,0xD4, //list
			0x43,0x4C,0xD2, //clr
			0x43,0x4D,0xC4, //cmd
			0x53,0x59,0xD3, //sys
			0x4F,0x50,0x45,0xCE, //open
			0x43,0x4C,0x4F,0x53,0xC5, //close
			0x47,0x45,0xD4, //get
			0x4E,0x45,0xD7, //new
			0x54,0x41,0x42,0xA8, //tab(
			0x54,0xCF, //to
			0x46,0xCE, //fn
			0x53,0x50,0x43,0xA8, //spc(
			0x54,0x48,0x45,0xCE, //then
			0x4E,0x4F,0xD4, //not
			0x53,0x54,0x45,0xD0, //step
			0xAB, //plus
			0xAD, //minus
			0xAA, //multiply
			0xAF, //divide
			0xDE, //power
			0x41,0x4E,0xC4, //and
			0x4F,0xD2, //on
			0xBE, //greater
			0xBD, //equal
			0xBC, //less
			0x53,0x47,0xCE, //sgn
			0x49,0x4E,0xD4, //int
			0x41,0x42,0xD3, //abs
			0x55,0x53,0xD2, //usr
			0x46,0x52,0xC5, //fre
			0x50,0x4F,0xD3, //pos
			0x53,0x51,0xD2, //sqr
			0x52,0x4E,0xC4, //rnd
			0x4C,0x4F,0xC7, //log
			0x45,0x58,0xD0, //exp
			0x43,0x4F,0xD3, //cos
			0x53,0x49,0xCE, //sin
			0x54,0x41,0xCE, //tan
			0x41,0x54,0xCE, //atn
			0x50,0x45,0x45,0xCB, //peek
			0x4C,0x45,0xCE, //len
			0x53,0x54,0x52,0xA4, //str$
			0x56,0x41,0xCC, //val
			0x41,0x53,0xC3, //asc
			0x43,0x48,0x52,0xA4, //chr$
			0x4C,0x45,0x46,0x54,0xA4, //left$
			0x52,0x49,0x47,0x48,0x54,0xA4, //right$
			0x4D,0x49,0x44,0xA4, //mid$
			0x47,0xCF, //go
			0x00
		],
		lineLengthMax = 88,
		lineNumberMax = 63999,
		lines = {},
		error = '',
		idx = 0,
		srcLength = src.length,
		sl = 1,
		isLC = false,
		raw = 0,
		bigEndien = true,
		eof = false;

	// no "go" on PET 2001, ROM 1.0
	if (isPetRom1) tokens.splice(tokens.length-3, 2);

	function getCh() {
		for (;;) {
			if (idx >= srcLength) {
				raw = 0;
				return 0;
				eof = true;
			}
			var c = src[idx++];
			if ((bigEndien && c === 3 && src[idx] === 0xC0)
				|| (!bigEndien && c === 0xC0 && src[idx] === 3)
				|| (c === 0xCF && src[idx] === 0x80)) {
				idx++;
				c = 0xFF; // pi
			}
			else if (c === 0x7E || c === 0xDE)
				c = 0xFF; // copies of pi in PETSCII
			else if (c < 0x20) {
				if (c === 9) { // tab
					c = 0x20;
				}
				else {
					var cr = false;
					if (c === 0x0D) {
						if (src[idx] === 0x0A) idx++;
						cr = true;
					}
					else if (c === 0x0A) cr = true;
					if (cr) c = 0;
				}
			}
			raw = c;
			if (isLC) {
				if (c >= 0x61 && c <= 0x7A) c &= 0xDF;
				else if (c >= 0x41 && c <= 0x5A) c |= 0x80;
			}
			eof = idx >= srcLength;
			if (c === 0 || c >= 0x20) return c;
		}
	}

	function gotCharCaseAdjusted() {
		if (raw >= 0x41 && raw <= 0x5A) {
			isLC = false;
			return raw;
		}
		else if (raw >= 0x61 && raw <= 0x7A) {
			isLC = true;
			return raw & 0xDF;
		}
		return raw;
	}

	//skip BOM
	if (src[0] == 0xEF && src[1] == 0xBB && src[2] == 0xBF) idx = 3;
	else if (src[0] == 0xFF && src[1] == 0xFE) idx = 2;
	else if (src[0] == 0xFE && src[1] == 0xFF) { idx = 2; bigEndien = false; }

	// parse loop
	while (idx < srcLength) {
		var c, ln = 0, dataFlag = false, tokenized = [], direct = true;
		// get line number
		c = getCh();
		while ((c >= 0x30 && c <= 0x39) || c === 0x20) {
			if (!c) break;
			if (c !== 0x20) ln = ln * 10 + c - 0x30;
			direct = false;
			c = getCh();
		}
		if (ln >= lineNumberMax) {
			error = 'line '+sl+': syntax error (illegal line number).';
			break;
		}
		if (direct) {
			while (c === 0x20) getCh();
			if (c !== 0) {
				error = 'line '+sl+': illegal direct mode (missing line number).';
				break;
			}
		}
		else {
			// tokenize line content
			while (c) {
				c = gotCharCaseAdjusted();
				// parse and tokenize like CBM BASIC
				if (c >= 0x80) {
					if (c === 0xFF) tokenized.push(c);
				}
				else if (c) {
					if (c === 0x20) tokenized.push(c);
					else if (c === 0x22) { //quote
						tokenized.push(c)
						c = getCh();
						while (c) {
							tokenized.push(c);
							if (c === 0x22) break;
							c = getCh();
						}
						if (!c && !eof) idx--;
					}
					else if (dataFlag) {
						tokenized.push(c);
					}
					else if (c === 0x3F) { //"?"
						c = 0x99;
						tokenized.push(c);
					}
					else if (c >= 0x30 && c < 0x3C) {
						tokenized.push(c);
					}
					else {
						// evaluate tokens
						var ptr = idx, b = c, cmd = 0, cnt = 0;
						for (;;) {
							var d = tokens[cnt] - c;
							if (d == 0) {
								c = getCh();
								cnt++;
							}
							else if (Math.abs(d) == 0x80) {
								c = 0x80 | cmd;
								break;
							}
							else {
								c = b;
								idx = ptr;
								while ((tokens[cnt++] & 0x80) == 0);
								if (tokens[cnt] == 0) break;
								cmd++;
							}
						}
						tokenized.push(c);
						if (c === 0x3A) dataFlag = false; //":"
						else if (c === 0x83) dataFlag = true; //"DATA"
						else if (c === 0x8F) {//"REM"
							c = getCh();
							while (c) {
								tokenized.push(c);
								c = getCh();
							}
							if (!eof) idx--;
						}
					}
				}
				c = getCh();
			}
			if (tokenized.length > lineLengthMax) {
				error = 'line '+sl+': string too long.';
				break;
			}
		}
		lines[ln] = tokenized;
		sl++;
	}

	// generate linked lines
	var	lns = [],
		prg = [],
		pc = startAddr;
	for (var n in lines) lns.push(n);
	lns.sort(function(a,b) { return a-b; });
	for (var i = 0; i < lns.length; i++) {
		var n = lns[i], tk = lines[n], tl = tk.length;
		if (tl) {
			var link = pc + tl + 5;
			prg.push(link & 0xFF);
			prg.push((link >> 8)  & 0xFF);
			prg.push(n & 0xFF);
			prg.push((n >> 8)  & 0xFF);
			for (var t = 0; t < tk.length; t++) prg.push(tk[t]);
			prg.push(0);
			pc = link;
		}
	}
	if (prg.length) {
		prg.push(0);
		prg.push(0);
		if (asPrgFile) prg.splice(0, 0, startAddr & 0xFF, (startAddr >> 8)  & 0xFF);
	}
	return { 'prg': prg, 'error': error};
}

// generate a plain text listing from tokenized BASIC

function basic2Txt(mem, startAddress) {
	var	tokens = [
			"END", "FOR", "NEXT", "DATA", "INPUT#", "INPUT", "DIM", "READ", "LET",
			"GOTO", "RUN", "IF", "RESTORE", "GOSUB", "RETURN", "REM", "STOP", "ON",
			"WAIT", "LOAD", "SAVE", "VERIFY", "DEF", "POKE", "PRINT#", "PRINT",
			"CONT", "LIST", "CLR", "CMD", "SYS", "OPEN", "CLOSE", "GET", "NEW",
			"TAB(", "TO", "FN", "SPC(", "THEN", "NOT", "STEP", "+", "-", "*", "/",
			"^", "AND", "ON", ">", "=", "<", "SGN", "INT", "ABS", "USR", "FRE",
			"POS", "SQR", "RND", "LOG", "EXP", "COS", "SIN", "TAN", "ATN", "PEEK",
			"LEN", "STR$", "VAL", "ASC", "CHR$", "LEFT$", "RIGHT$", "MID$", "GO"
		],
		lines = [],
		addr = (!startAddress || isNaN(startAddress))? 0x0401:Number(startAddress) | 0;
	for (;;) {
		var lineLink = mem[addr++] + (mem[addr++]<<8);
		if (!lineLink) break;
		var	ln = String(mem[addr++] + (mem[addr++]<<8)) + ' ',
			isPrint = false,
			isStringFn = false,
			parenCnt = 0,
			c = mem[addr++];
		while (c) {
			if (c === 0xFF) {
				ln += '\u03C0';
			}
			else if (c & 0x80) {
				var t = tokens[c ^ 0x80];
				if (t) {
					ln += t;
					if (t === 'REM') {
						c = mem[addr++];
						while(c) {
							if (c >= 0x20 && c < 0x80) ln += String.fromCharCode(c);
							else if (c === 0xFF) ln += '\u03C0';
							c = mem[addr++];
						}
						break;
					}
					if (/^PRINT/.test(t)) isPrint = true;
					else if (/^(?:MID|LEFT|RIGHT)\$|LEN|VAL|ASC$/.test(t)) {
						isStringFn = true;
						parenCnt = 0;
					}
				}
			}
			else if (c === 0x22) {
				var s= '', q = false, sep = (isPrint && !isStringFn)? ';':'+';
				c = mem[addr++];
				for (;;) {
					if (c === 0x22 || c === 0) {
						if (q) s += '"';
						q = false;
						if (!c) addr--;
						break;
					}
					else if (c === 0xFF) {
						if (!q) {
							if (s) s += sep;
							s += '"';
							q = true;
						}
						s += '\u03C0';
					}
					else if (c >= 0x20 && c < 0x80) {
						if (!q) {
							if (s) s += sep;
							s += '"';
							q = true;
						}
						s += String.fromCharCode(c);
					}
					else {
						if (q) {
							s += '"';
							q = false;
						}
						if (s) s += sep;
						s += 'CHR$(' + c + ')';
					}
					c = mem[addr++];
				}
				ln += s? s : '""';
			}
			else {
				ln += String.fromCharCode(c);
				if (c === 0x3A) isPrint = isStringFn = false; //colon
				else if (isStringFn) {
					if (c === 0x28) parenCnt++; //left parenthesis
					else if (c === 0x29 && --parenCnt === 0) isStringFn = false; //right parenthesis
				}
			}
			c = mem[addr++];
		}
		lines.push(ln);
		addr = lineLink;
	}
	return lines.join('\n') || '';
}


// generate BASIC print statements from screen memory

var ScreenGenerator = (function() {
	var screen;

	function load(bytes) {
		screen = bytes.slice();
	}

	function unload() {
		screen = null;
	}

	function generate(lineNumber, step, toUpperCase, trim) {
		if (!screen) return '';
		// normalize arguments
		lineNumber = (lineNumber && !isNaN(lineNumber))? Number(lineNumber):1000;
		step = (step && !isNaN(step))? Number(step):10;
		toUpperCase = typeof toUpperCase === 'undefined' || Boolean(toUpperCase);
		trim = typeof trim === 'undefined' || Boolean(trim);

		var	rows = 25, cols = 40,
			lineLengthMax = 80, //BASIC input buffer is 88, but VICE has problems
			screenLines = [],
			lines = [],
			line = '',
			buffer = '',
			rvs = false,
			quoted = false,
			chr = toUpperCase? 'CHR$(':'chr$(';

		function charOut(c, toCode) {
			if (toCode) {
				if (c === 0x22) {
					quoted = !quoted;
				}
				else if (quoted) {
					lineAdd(chr + 0x22 +');');
					lineAdd(chr + 0x9D +');');
					quoted = false;
				}
				if (buffer) {
					lineAdd('"' + buffer + '";');
					buffer = '';
				}
				lineAdd(chr + c +');');
			}
			else buffer += String.fromCharCode(c);
		}

		function lineAdd(chunk) {
			if (line.length + chunk.length <= lineLengthMax) {
				line += chunk;
			}
			else {
				lines.push(line);
				line = String(lineNumber) + ' ?' + chunk;
				lineNumber += step;
			}
		}

		function lineFlush() {
			if (buffer) {
				if (line.length + buffer.length > lineLengthMax) {
					lines.push(line);
					line = String(lineNumber) + ' ?';
					lineNumber += step;
				}
				line += '"' + buffer + '";';
				buffer = '';
			}
			lines.push(line);
			line = String(lineNumber) + ' ?';
			lineNumber += step;
		}

		// split screen contents into lines
		for (var i = 0, m = rows * cols; i < m; i += cols)
			screenLines.push(screen.slice(i, i + cols));
		// trim right-hand white-space
		if (trim) {
			var bottom = true;
			for (var r = rows-1; r >= 0; r--) {
				var l = cols, s = screenLines[r];
				for (var c = cols-1; c >= 0 && s[c] === 0x20; c--) l--;
				if (bottom && l === 0) screenLines.length--;
				else {
					if (l !== cols) s.length = l;
					bottom = false;
				}
			}
		}
		else if (screenLines[rows-1][cols-1] == 0x20) {
			screenLines[rows-1].length--;
		}

		// generate BASIC source text
		var r0 = 0;
		// initialize first line
		// generate either a home (trimmed text) or clear screen command
		line = String(lineNumber) + ' ?' + chr + '147)';
		if (screenLines[0].length) line += ';';
		else r0++;
		lineNumber += step;
		lineFlush();  // start a new line
		for (var r = r0, rl = screenLines.length - 1; r <= rl; r++) {
			var s = screenLines[r];
			for (var c=0; c < s.length; c++) {
				var sc = s[c];
				// handle revers video
				if (sc & 0x80) {
					if (!rvs) {
						charOut(18, true);
						rvs = true;
					}
					sc ^= 0x80;
				}
				else if (rvs) {
					charOut(146, true);
					rvs = false;
				}
				// to PETSCII
				if (sc < 0x20) sc |= 0x40;
				else if (sc >= 0x40 && sc < 0x60) sc |= 0x80;
				else if (sc >= 0x60) sc += 0x40;
				// to ASCII printable
				if (sc === 0x22) charOut(0x22, true); //quote
				else if (sc === 0xDE) charOut(0x03C0); //π
				else if (toUpperCase) {
					if (sc < 0x60) charOut(sc);
					else charOut(sc, true);
				}
				else {
					if (sc <= 0x40 || sc > 0x5A && sc < 0x60) charOut(sc);
					else if (sc <= 0x5A) charOut(sc + 0x20);
					else if (sc >= 0xC1 && sc <= 0xDA) charOut(sc & 0x7F);
					else charOut(sc, true);
				}
			}
			if (r === rl && rvs) charOut(146, true);
			lineFlush();
			// line-length < cols? remove last semicolon
			if (r != rows -1 && s.length < cols) {
				lines[lines.length - 1] = lines[lines.length - 1].replace(/;$/, '');
				rvs = quoted = false;
			}
		}
		lineNumber -= step;
		var keyDummy = lineNumber + ' get k$:if k$="" goto ' + lineNumber
			+ ':rem wait for keypress';
		lines.push(toUpperCase? keyDummy.toUpperCase():keyDummy);
		return lines.join('\n');
	}

	return {
		'load': load,
		'unload': unload,
		'generate': generate
	};
})();


// memory dumps

function hex(n, l) {
	var s = n.toString(16).toUpperCase();
	while (s.length < l) s = '0' + s;
	return s;
}

function hexDump(mem, addr, end, oldStyle) {
	function dump() {
		if (addr % 8 === 0) {
			if (out) out += '  ' + charsPrefix + chars + '\n';
			out +=  addrPrefix + hex(addr, 4) + addrPostfix;
			chars = '';
		}
		var c = mem[addr++];
		out += ' ' + hex(c, 2);
		chars += (c >= 0x20 && c <= 0x60)? String.fromCharCode(c):'.';
		return c;
	}
	if (addr >= mem.length) return 'Error: Start address out of bounds.';
	if (addr > end) return 'Error: End address lower than start address.';
	var	out = '', chars='',
		addrPrefix = oldStyle? ':':'',
		addrPostfix = oldStyle? '':':',
		charsPrefix = oldStyle? ';':'';
	while (addr <= end) dump();
	if (chars) {
		while (addr++ % 8 !== 0) out += '   ';
		out += '  ' + charsPrefix + chars;
	}
	return out;
}

function hexDumpBasic(mem, oldStyle) {
	function dump() {
		if (addr % 8 === 0) {
			if (out) out += '  ' + charsPrefix + chars + '\n';
			out +=  addrPrefix + hex(addr, 4) + addrPostfix;
			chars = '';
		}
		var c = mem[addr++] || 0;
		out += ' ' + hex(c, 2);
		chars += (c >= 0x20 && c <= 0x60)? String.fromCharCode(c):'.';
		return c;
	}
	var	addr = 0x400, out = '', chars='',
		addrPrefix = oldStyle? ':':'',
		addrPostfix = oldStyle? '':':',
		charsPrefix = oldStyle? ';':'';
	dump();
	for (;;) {
		if (dump() + (dump()<<8) === 0) break;
		do {} while (dump());
	}
	if (chars) {
		while (addr++ % 8 !== 0) out += '   ';
		out += '  ' + chars;
	}
	return out;
}

// generate PRG file from memory, from start-address up to end-of-basic marker (0x00 0x00 0x00)

function convertToPrg(mem, startAddress) {
	var	addr = (!startAddress || isNaN(startAddress))? 0x0401:Number(startAddress) | 0,
		leadIn = String.fromCharCode(startAddress & 0xff) + String.fromCharCode((startAddress >> 8) & 0xff),
		out = '';

	function putChr() {
		var c = mem[addr++] || 0;
		out += String.fromCharCode(c);
		return c;
	}

	for (;;) {
		if (putChr() + (putChr()<<8) === 0) break;
		do {} while (putChr());
	}
	return (out.length > 2)? leadIn + out : '';
}

// 6502 disassembler

var	opctab= [
		['BRK','imp'], ['ORA','inx'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['ORA','zpg'], ['ASL','zpg'], [   '','imp'],
		['PHP','imp'], ['ORA','imm'], ['ASL','acc'], [   '','imp'],
		[   '','imp'], ['ORA','abs'], ['ASL','abs'], [   '','imp'],
		['BPL','rel'], ['ORA','iny'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['ORA','zpx'], ['ASL','zpx'], [   '','imp'],
		['CLC','imp'], ['ORA','aby'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['ORA','abx'], ['ASL','abx'], [   '','imp'],
		['JSR','abs'], ['AND','inx'], [   '','imp'], [   '','imp'],
		['BIT','zpg'], ['AND','zpg'], ['ROL','zpg'], [   '','imp'],
		['PLP','imp'], ['AND','imm'], ['ROL','acc'], [   '','imp'],
		['BIT','abs'], ['AND','abs'], ['ROL','abs'], [   '','imp'],
		['BMI','rel'], ['AND','iny'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['AND','zpx'], ['ROL','zpx'], [   '','imp'],
		['SEC','imp'], ['AND','aby'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['AND','abx'], ['ROL','abx'], [   '','imp'],
		['RTI','imp'], ['EOR','inx'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['EOR','zpg'], ['LSR','zpg'], [   '','imp'],
		['PHA','imp'], ['EOR','imm'], ['LSR','acc'], [   '','imp'],
		['JMP','abs'], ['EOR','abs'], ['LSR','abs'], [   '','imp'],
		['BVC','rel'], ['EOR','iny'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['EOR','zpx'], ['LSR','zpx'], [   '','imp'],
		['CLI','imp'], ['EOR','aby'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['EOR','abx'], ['LSR','abx'], [   '','imp'],
		['RTS','imp'], ['ADC','inx'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['ADC','zpg'], ['ROR','zpg'], [   '','imp'],
		['PLA','imp'], ['ADC','imm'], ['ROR','acc'], [   '','imp'],
		['JMP','ind'], ['ADC','abs'], ['ROR','abs'], [   '','imp'],
		['BVS','rel'], ['ADC','iny'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['ADC','zpx'], ['ROR','zpx'], [   '','imp'],
		['SEI','imp'], ['ADC','aby'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['ADC','abx'], ['ROR','abx'], [   '','imp'],
		[   '','imp'], ['STA','inx'], [   '','imp'], [   '','imp'],
		['STY','zpg'], ['STA','zpg'], ['STX','zpg'], [   '','imp'],
		['DEY','imp'], [   '','imp'], ['TXA','imp'], [   '','imp'],
		['STY','abs'], ['STA','abs'], ['STX','abs'], [   '','imp'],
		['BCC','rel'], ['STA','iny'], [   '','imp'], [   '','imp'],
		['STY','zpx'], ['STA','zpx'], ['STX','zpy'], [   '','imp'],
		['TYA','imp'], ['STA','aby'], ['TXS','imp'], [   '','imp'],
		[   '','imp'], ['STA','abx'], [   '','imp'], [   '','imp'],
		['LDY','imm'], ['LDA','inx'], ['LDX','imm'], [   '','imp'],
		['LDY','zpg'], ['LDA','zpg'], ['LDX','zpg'], [   '','imp'],
		['TAY','imp'], ['LDA','imm'], ['TAX','imp'], [   '','imp'],
		['LDY','abs'], ['LDA','abs'], ['LDX','abs'], [   '','imp'],
		['BCS','rel'], ['LDA','iny'], [   '','imp'], [   '','imp'],
		['LDY','zpx'], ['LDA','zpx'], ['LDX','zpy'], [   '','imp'],
		['CLV','imp'], ['LDA','aby'], ['TSX','imp'], [   '','imp'],
		['LDY','abx'], ['LDA','abx'], ['LDX','aby'], [   '','imp'],
		['CPY','imm'], ['CMP','inx'], [   '','imp'], [   '','imp'],
		['CPY','zpg'], ['CMP','zpg'], ['DEC','zpg'], [   '','imp'],
		['INY','imp'], ['CMP','imm'], ['DEX','imp'], [   '','imp'],
		['CPY','abs'], ['CMP','abs'], ['DEC','abs'], [   '','imp'],
		['BNE','rel'], ['CMP','iny'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['CMP','zpx'], ['DEC','zpx'], [   '','imp'],
		['CLD','imp'], ['CMP','aby'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['CMP','abx'], ['DEC','abx'], [   '','imp'],
		['CPX','imm'], ['SBC','inx'], [   '','imp'], [   '','imp'],
		['CPX','zpg'], ['SBC','zpg'], ['INC','zpg'], [   '','imp'],
		['INX','imp'], ['SBC','imm'], ['NOP','imp'], [   '','imp'],
		['CPX','abs'], ['SBC','abs'], ['INC','abs'], [   '','imp'],
		['BEQ','rel'], ['SBC','iny'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['SBC','zpx'], ['INC','zpx'], [   '','imp'],
		['SED','imp'], ['SBC','aby'], [   '','imp'], [   '','imp'],
		[   '','imp'], ['SBC','abx'], ['INC','abx'], [   '','imp']
	],
	steptab = {
		'imp':1,
		'acc':1,
		'imm':2,
		'abs':3,
		'abx':3,
		'aby':3,
		'zpg':2,
		'zpx':2,
		'zpy':2,
		'ind':3,
		'inx':2,
		'iny':2,
		'rel':2
	};

function disassemble(mem, start, end, addressToSymbolDict) {
	/*
	addressToSymbolDict: object, optional -- dictionary of symbolic addresses
	example: {
		0x401: 'BASIC',
		0x8000: 'SCREEN',
		...
	}
	*/
	var symbolsSeen = {}, symbolicLabels = {}, targets = [], labels = {},
	    labelColumnWidth = 8, blanks = '            ',
	    terminateLabelsByColon = false,
	    maxMem = mem.length;

	if (!addressToSymbolDict || typeof addressToSymbolDict === 'object')
		addressToSymbolDict = {};

	function addressString(a, l) {
		if (addressToSymbolDict[a]) { symbolsSeen[a] = true; return addressToSymbolDict[a]; }
		if (addressToSymbolDict[a-1]) { symbolsSeen[a-1] = true; return addressToSymbolDict[a-1]+'+1'; }
		return labels[a] || '$'+hex(a, l);
	}

	function list(addr, addrStr, opc, disas) {
		var label = labels[addr] || addressToSymbolDict[addr] || '';
		if (terminateLabelsByColon && label) label += ':';
		listing += addrStr + blanks.substring(0, 6-addrStr.length)
			+ opc + blanks.substring(0, 11-opc.length)
			+ label + blanks.substring(0, labelColumnWidth-label.length)
			+ disas+'\n';
	}

	function getMem(a) {
		return (a < maxMem)? mem[a] || 0:0;
	}

	function disassembleStep() {
		var	addr = hex(pc, 4),
			instr = getMem(pc),
			opc = hex(instr, 2),
			disas = opctab[instr][0] || '.byte $' + opc,
			adm = opctab[instr][1],
			step = steptab[adm],
			op;
		if (step == 2) {
			op = getMem(pc+1);
			opc += ' ' + hex(op, 2);
		}
		else if (step == 3) {
			op = (getMem(pc+2)<<8) | getMem(pc+1);
			opc += ' ' + hex(getMem(pc+1), 2) + ' ' + hex(getMem(pc+2));
		}
		else {
			opc+='';
		}
		// format and output to listing
		switch (adm) {
			case 'imm':
				disas+=' #$'+hex(op, 2);
				break;
			case 'zpg':
				disas+=' '+addressString(op, 2);
				break;
			case 'acc':
				disas+=' A';
				break;
			case 'abs':
				disas+=' '+addressString(op, 4);
				break;
			case 'zpx':
				disas+=' '+addressString(op, 2)+',X';
				break;
			case 'zpy':
				disas+=' '+addressString(op, 2)+',Y';
				break;
			case 'abx':
				disas+=' '+addressString(op, 4)+',X';
				break;
			case 'aby':
				disas+=' '+addressString(op, 4)+',Y';
				break;
			case 'iny':
				disas+=' ('+addressString(op, 2)+'),Y';
				break;
			case 'inx':
				disas+=' ('+addressString(op, 2)+',X)';
				break;
			case 'rel':
				var offset = getMem(pc+1), target = pc+2;
				if (offset & 128) {
					target -= (offset ^ 255)+1;
				}
				else {
					target += offset;
				}
				target &= 0xFFFF;
				disas += ' '+ (labels[target] || addressString(target, 4));
				break;
			case 'ind' :
				disas+=' ('+addressString(op, 4)+')';
				break;
		}
		list(pc, addr, opc, disas);
		pc = pc+step;
	}

	function collectTargets() {
		var ot = opctab[getMem(pc)], instr = ot[0];
		switch (instr) {
			case 'BPL':
			case 'BMI':
			case 'BVC':
			case 'BVS':
			case 'BCC':
			case 'BCS':
			case 'BNE':
			case 'BEQ':
				var offset = getMem(pc+1) || 0, target = pc+2;
				if (offset & 128) {
					target -= (offset ^ 255)+1;
				}
				else {
					target += offset;
				}
				addLabel(target & 0xFFFF);
				break;
			case 'JMP':
			case 'JSR':
				addLabel((getMem(pc+2)<<8) | getMem(pc+1));
				break;
		}
		if (addressToSymbolDict[pc]) symbolicLabels[addressToSymbolDict[pc]] = true;
		pc += steptab[ot[1]];
	}

	function addLabel(target) {
		if (!addressToSymbolDict[target] && !labels[target] && target >= start  && target <= end
			&& (target < 0x8000
			|| (target >= 0xC000 && target <= 0xE7FF)
			|| (target >= 0xF000 && target <= 0xFFFF))) labels[target] = 'l'+hex(target, 4);
	}

	function scanSymbolLengths(obj) {
		var  max = 0;
		for (var s in obj) {
			var l = s.length;
			if (l > max) max = l;
		}
		max += (max % 2)? 3:2;
		if (max > labelColumnWidth) {
			labelColumnWidth = max;
			while (blanks.length < max) blanks += ' ';
		}
	}

	var pc, listing = '';
	if (!start) start = 0;
	if (!end) end = 0;
	if (isNaN(start) || start < 0) return 'Error: Start address not a valid value.';
	if (isNaN(end) || end < 0) return 'Error: End address not a valid value.';
	start &= 0xFFFF;
	end &= 0xFFFF;
	if (end < start) end = maxMem-1;

	pc = start;
	while (pc <= end) collectTargets();
	scanSymbolLengths(symbolicLabels);

	list(-1, '','','* = '+hex(start, 4));
	pc = start;
	while (pc <= end) disassembleStep();
	list(-1, '','','.end');

	var symbolList = [];
	for (var a in symbolsSeen) {
		var n = Number(a), s = addressToSymbolDict[a];
		if (!symbolicLabels[s]) symbolList.push(s + ' = $' + hex(n, n <= 0xFF? 2:4));
	}
	if (symbolList.length) {
		listing = symbolList.join('\n') + '\n\n' + listing;
	}

	return listing;
}

// D64 disk image parser

var D64 = (function() {

	var prgPath = 'prgs/',
		typeFilter = 2, //prg
		data = null,
		dsize = 0,
		sectorsSeen = [],
		dir = [],
		diskName;

	var trackMap = { // #track: [sectors, byte-offset]
			'1':  [21, 0x00000],
			'2':  [21, 0x01500],
			'3':  [21, 0x02A00],
			'4':  [21, 0x03F00],
			'5':  [21, 0x05400],
			'6':  [21, 0x06900],
			'7':  [21, 0x07E00],
			'8':  [21, 0x09300],
			'9':  [21, 0x0A800],
			'10': [21, 0x0BD00],
			'11': [21, 0x0D200],
			'12': [21, 0x0E700],
			'13': [21, 0x0FC00],
			'14': [21, 0x11100],
			'15': [21, 0x12600],
			'16': [21, 0x13B00],
			'17': [21, 0x15000],
			'18': [19, 0x16500],
			'19': [19, 0x17800],
			'20': [19, 0x18B00],
			'21': [19, 0x19E00],
			'22': [19, 0x1B100],
			'23': [19, 0x1C400],
			'24': [19, 0x1D700],
			'25': [18, 0x1EA00],
			'26': [18, 0x1FC00],
			'27': [18, 0x20E00],
			'28': [18, 0x22000],
			'29': [18, 0x23200],
			'30': [18, 0x24400],
			'31': [17, 0x25600],
			'32': [17, 0x26700],
			'33': [17, 0x27800],
			'34': [17, 0x28900],
			'35': [17, 0x29A00],
			'36': [17, 0x2AB00], // non-standard
			'37': [17, 0x2BC00],
			'38': [17, 0x2CD00],
			'39': [17, 0x2DE00],
			'40': [17, 0x2EF00],
			'41': [17, 0x30000], // extended non-standard
			'42': [17, 0x31100]
		},
		typeMap = ['DEL','SEQ','PRG','USR','REL'];

	function loadDiskImage(diskImageName, fileName) {
		if (!diskImageName) return;
		diskImageName = String(diskImageName).replace(/\//g, '');
		if (diskImageName === '') return;
		diskName = diskImageName;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', prgPath + encodeURIComponent(diskImageName) + '?uid=' + Date.now().toString(36), true);
		if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
		if (xhr.overrideMimeType) xhr.overrideMimeType('text/plain; charset=x-user-defined');
		xhr.onload = function xhr_onload() {
			if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
				data = new DataView(xhr.response);
				dsize = data.byteLength;
				if (dsize) {
					parseDirectory();
					if (fileName) {
						loadFile(fileName, true);
					}
					else {
						displayDirectory();
					}
				}
				else {
					data = null;
					console.warn('File "'+diskImageName+'" is empty.');
				}
			}
			else {
				xhr.onerror();
			}
		}
		xhr.onerror = function xhr_onerror() {
			var msg = 'PET: Unable to load file "'+diskImageName+'"';
			if (xhr.status) msg += ' ('+xhr.status+')';
			msg +=  (xhr.statusText? ': '+xhr.statusText:'.');
			console.warn(msg);
		}
		xhr.send(null);
	}

	function readDiskImage(file) {
		diskName = file.name;
		if (diskName.indexOf('\\')) diskName = diskName.replace(/^.*\\/, '');
		if (diskName.indexOf('/')) diskName = diskName.replace(/^.*\//, '');
		if (!diskName) diskName = '*';
		var fread = new FileReader();
		fread.readAsArrayBuffer(file);
		fread.onload = function(levent) {
			data = new DataView(levent.target.result);
			dsize = levent.target.result.byteLength;
			if (dsize) {
				parseDirectory();
				displayDirectory();
			}
		}
	}

	function parseDirectory() {
		dir.length = sectorsSeen.length = 0;
		var t=18, s=1;
		while (t) {
			var offset = getSectorOffset(t, s);
			if (offset < 0) return;
			t =  data.getUint8(offset);
			s =  data.getUint8(offset+1);
			for (var i = 0; i < 0xff; i+=0x20) {
				var entry = {}, c = offset + i, fname = '',
					type = data.getUint8(c+2)&7;
				entry.type = typeMap[type] || '';
				entry.track = data.getUint8(c+3);
				entry.sector = data.getUint8(c+4);
				entry.size = (((data.getUint8(c+0x1e)+data.getUint8(c+0x1f)*256)*254)/1024).toFixed(2);
				for (var n = c+5, l = c+21; n < l; n++) {
					var ch = data.getUint8(n);
					if (ch == 0) break;
					if (ch >= 0x20 && ch != 0xa0) fname += String.fromCharCode(ch);
				}
				if (fname == '' && type == 0 && entry.size == 0) break;
				if (!typeFilter || type === typeFilter) {
					entry.name = fname;
					dir.push(entry);
				}
			}
		}
	}

	function loadFile(entry, autorun, reset, minRam) {
		var index = -1;
		if (typeof entry === 'string') {
			var uc = entry.toUpperCase();
			for (var i=0; i<dir.length; i++) {
				if (dir[i].name == uc) {
					index = i;
					break;
				}
			}
		}
		else if (typeof entry === 'number') {
			index = entry;
		}
		if (index < 0 || index >= dir.length) {
			console.error('disk image error: no such file ("'+entry+'").');
			return;
		}
		sectorsSeen.length = 0;
		var f = dir[index], bytes = [], t = f.track, s = f.sector;
		while (t) {
			var offset = getSectorOffset(t, s);
			if (offset < 0) return;
			t =  data.getUint8(offset);
			s =  data.getUint8(offset+1);
			for (var j = offset+2, l = offset+256; j < l; j++) bytes.push(data.getUint8(j));
		}
		if (typeof minRam === 'number') {
			if (minRam < 1024) minRam *= 1024;
		}
		else {
			minRam = 0;
		}
		var addr = bytes.shift() + bytes.shift()*256,
			ramRequired = Math.max(minRam, addr + bytes.length + 0x200),
			loadAndRun = function() {
				pet2001.ieeeLoadData(addr, bytes);
				autoLoad(f.name.toLowerCase(), autorun);
			};
		if (ramRequired >= pet2001.getRamSize()) {
			setRamSize(ramRequired/1024, loadAndRun);
		}
		else if (reset) {
			pet2001.reset();
			waitForCursor(loadAndRun);
		}
		else loadAndRun();
	}

	function getSectorOffset(track, sector) {
		var t = trackMap[track];
		if (t && t[0]>sector && dsize >= t[1]+256*(sector+1)) {
			if (sectorsSeen[track]) {
				if (sectorsSeen[track][sector]) {
					console.error('disk image error: circular track link at track '+track+', sector '+sector+'.');
					return -1;
				}
			}
			else {
				sectorsSeen[track] = [];
			}
			sectorsSeen[track][sector] = true;
			return t[1] + 256 * sector;
		}
		console.error('disk image error: no such track or sector, track '+track+', sector '+sector+'.');
		return -1;
	}

	function displayDirectory() {
		displayDirectoryList(dir, diskName);
	}

	function unload() {
		dir.length = 0;
		diskName = '';
		data = null;
	}

	return {
		'readDiskImage': readDiskImage,
		'loadDiskImage': loadDiskImage,
		'loadFile': loadFile,
		'unload': unload,
		'displayDirectory': displayDirectory
	};

})();

return {
	'txt2Basic': txt2Basic,
	'basic2Txt': basic2Txt,
	'convertToPrg': convertToPrg,
	'ScreenGenerator': ScreenGenerator,
	'hexDump': hexDump,
	'hexDumpBasic': hexDumpBasic,
	'disassemble': disassemble,
	'D64': D64
};
})();