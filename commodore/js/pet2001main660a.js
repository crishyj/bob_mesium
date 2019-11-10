//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY AUTHOR AND CONTRIBUTORS ``AS IS'' AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED.  IN NO EVENT SHALL AUTHOR OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
// OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
// OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.
//

// pet2001main.js

// Modified and extended by (c) Norbert Landsteiner, 2017

var petContext = document.getElementById('petscreen').getContext("2d");
var pet2001 = new Pet2001(petContext);
var petIntervalTime = 20;
var extraCycles = 0;

window.onkeypress = PetKeys.onKeyPress;
window.addEventListener('keydown', PetKeys.onKeyDown, false);
window.addEventListener('keyup', PetKeys.onKeyUp, false);
enableDragAndDropLoader(document.getElementById('petvid'));

function petIntervalFunc() {
    pet2001.cycle(1000 * petIntervalTime);
}

var petIntervalHandle = window.setInterval(petIntervalFunc, petIntervalTime);

function blankTimeoutFunc() {
    pet2001.blankTimeoutFunc();
}

function resetButton() {
    pet2001.reset();
    PetKeys.reset();
    hideCS2001Labels();
}

function pauseButton() {
    if (petIntervalHandle != null) {
        window.clearInterval(petIntervalHandle);
        petIntervalHandle = null;
        document.getElementById('pausebutton').value = 'Resume';
    }
    else {
        petIntervalHandle = window.setInterval(petIntervalFunc, petIntervalTime);
        document.getElementById('pausebutton').value = ' Pause ';
    }
}

function romSelection() {
    var vers = document.getElementById('romselection').value;
    pet2001.setRomVers(vers);
}

function ramsizeSelection() {
    var size = document.getElementById('ramselection').value;
    pet2001.setRamSize(size * 1024);
}

function setColor(clr) {
	pet2001.video.setColor(clr);
}

function setKeyRepeat(v) {
	var repeat = (typeof v === 'string')? v.toLowerCase() === 'true':Boolean(v);
	PetKeys.setKeyRepeat(repeat);
}

function setRamSize(size, callback) {
	var sizes = [8, 16, 32];
	size = parseFloat(size);
	for (var i = 0, max = sizes.length-1; i <= max; i++) {
		if (sizes[i] >= size) {
			size = sizes[i];
			break;
		}
		if (i === max) size = sizes[max];
	}
	adjustSelect('ramselection', size);
    pet2001.setRamSize(size * 1024);
    if (typeof callback === 'function') waitForCursor(callback);
}

function setRomVersion(vers, callback) {
	vars = parseInt(vers, 10);
	if (vers != pet2001.setRomVers() && vers >= 1 && vers <= 2) {
		adjustSelect('romselection', vers);
    	pet2001.setRomVers(vers);
    }
    if (typeof callback === 'function') waitForCursor(callback);
}

function adjustSelect(id, v) {
	var select = document.getElementById(id);
	if (select) {
		var options = select.options;
		for (var i = 0; i < options.length; i++) {
			if (options[i].value == v) {
				select.selectedIndex = i;
				break;
			}
		}
	}
}

var scrollState;
function saveScrollState() {
	var sx = isNaN(window.scrollX)? window.pageXOffset:window.scrollX,
		sy = isNaN(window.scrollY)? window.pageYOffset:window.scrollY;
	scrollState = {'x':sx, 'y': sy};
}
function restoreScrollState(instantaneously) {
	var t0, sx, sy, tx, ty,
		reqAnimFrame = window.requestAnimationFrame||window.mozRequestAnimationFrame
		||window.webkitRequestAnimationFrame||window.oRequestAnimationFrame||null,
		now = Date.now || function() { return new Date().getTime(); };
	function scrollIntoPosition() {
		var t = (now() - t0)/140;
		if (t >= 1) {
			window.scrollTo(tx, ty);
		}
		else {
			window.scrollTo(sx+(tx-sx)*t, sy+(ty-sy)*t);
			if (reqAnimFrame) reqAnimFrame(scrollIntoPosition);
			else setTimeout(scrollIntoPosition, 20);
		}
	}
	if (typeof scrollState === 'object' && scrollState && !(isNaN(scrollState.x) || isNaN(scrollState.y))) {
		sx = isNaN(window.scrollX)? window.pageXOffset:window.scrollX;
		sy = isNaN(window.scrollY)? window.pageYOffset:window.scrollY;
		if (sx != scrollState.x || sy != scrollState.y) {
			if (instantaneously) {
				window.scrollTo(scrollState.x, scrollState.y);
			}
			else {
				tx = scrollState.x;
				ty = scrollState.y;
				t0 = now();
				scrollIntoPosition();
			}
		}
	}
	scrollState = null;
	if (window.focus) window.focus();
}

// import / export

function petExport(select) {
	var idx = select.selectedIndex;
	select.selectedIndex = 0;
	if (idx > 0) {
		var opt = select.options[idx].value;
		switch(opt) {
			case 'screen as text': showTextExport('Screen Text (Unicode)', pet2001.video.exportText(false)); break;
			case 'image': showScreenshot(true); break;
			case 'image marginless': showScreenshot(false); break;
			case 'hardcopy': showHardCopy(); break;
			case 'screen as hex': showTextExport('Screen Memory', pet2001.video.exportText(true)); break;
			case 'screen as basic': exportScreenAsProgram(); break;
			case 'basic as prg': exportBasicAsPrg(); break;
			case 'list basic':
			case 'hex-dump basic':
			case 'hex-dump':
			case 'disassembly':
				exportMemory(opt); break;
		}
	}
}

function loadFile(infile, callback) { // modified to take optional arguments, NL, 2017
    var file = infile || document.getElementById('loadfile').files[0];

    if (!file) return;
    if ((/\.d64$/i).test(file.name)) {
		Utils.D64.readDiskImage(file);
    }
	else {
		showDirectoryButton(false);
		var fread = new FileReader();
		fread.readAsArrayBuffer(file);
		fread.onload = function(levent) {
			if ((/\.(te?xt|bas?)$/i).test(file.name)) {
				var parsed = Utils.txt2Basic(levent.target.result,
					0x0401, false, pet2001.getRomVers() == 1);
				if (parsed.error) alert('Parse Error\n'+parsed.error);
				else {
					pet2001.ieeeLoadData(0x401, parsed.prg);
					if (typeof callback === 'function') callback();
				}
			}
			else {
				var data = new DataView(levent.target.result);
				var size = levent.target.result.byteLength;
				var addr = data.getUint8(0) + data.getUint8(1) * 256;
		
				var bytes = Array(size - 2);
				for (var i = 0; i < size - 2; i++)
					bytes[i] = data.getUint8(i + 2);
		
				pet2001.ieeeLoadData(addr, bytes);
				if (typeof callback === 'function') callback();
			}
		}
    }
}

function saveFile(filename, data, optShowAsLink) {
    var link = window.document.createElement('a');
    link.href = "data:application/octet-stream;base64," + btoa(data);
    if (typeof link.download !== 'undefined') {
    	if (!filename) {
    		if (optShowAsLink) { // default filename (override in OS dialog)
    			filename = 'PET-program.prg';
    		}
    		else { // ask user and sanitize
				filename = prompt('Filename:', 'PET-program.prg');
				if (!filename) return;
				filename = filename.replace(/[\/\\]/g, '_');
				if (!RegExp(/\.prg$/i).test(filename)) filename = filename.replace(/\.\w*$/, '') + '.prg';
    		}
    	}
		link.download = filename;
		if (!optShowAsLink) { // save in downloads directory by default
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			return;
		}
    }
    // show the link (right-click to save)
	var el = document.getElementById('downloadlink'),
		content = document.getElementById('downloadlinkParent');
	if (el && content) {
		link.innerText = 'Right-click me to save...';
		while (content.firstChild) content.removeChild(content.firstChild);
		content.appendChild(link);
		el.hidden = false;
	}
}

function runText(txt, resetAndLoad) {
	if (!(/^[0-9]/).test(txt)) {
		if (!(/[\r\n]$/).test(txt)) txt += '\n';
		PetKeys.reset();
		PetKeys.type(txt);
	}
	else {
		var parsed = Utils.txt2Basic(txt, 0x0401, false, pet2001.getRomVers() == 1);
		if (parsed.error) alert('Parse Error\n'+parsed.error);
		else {
			if (resetAndLoad) {
				pet2001.reset();
				PetKeys.reset();
				pet2001.ieeeLoadData(0x401, parsed.prg);
				autoLoad('', true);
			}
			else {
				pet2001.hw.writeRam(0x401, parsed.prg, parsed.prg.length);
				PetKeys.reset();
				PetKeys.type(['run']);
				var el = document.getElementById('petvid');
				if (el && el.focus) el.focus();
			}
		}
	}
}

function exportBasicAsPrg() {
	var mem = [], maxRAM = pet2001.hw.getRamSize();
	pet2001.hw.readRam(0, mem, maxRAM);
	var data = Utils.convertToPrg(mem, 0x401);
	if (data) {
		saveFile('', data, true);
	}
	else {
		alert('No BASIC program found.');
	}
}

function exportMemory(job) {
	var mem = [], maxRAM = pet2001.hw.getRamSize();
	pet2001.hw.readRam(0, mem, maxRAM);
	if (job == 'hex-dump basic') {
		showTextExport('BASIC Program (Hex-Dump)', Utils.hexDumpBasic(mem) || '-- no program found --');
	}
	else if (job == 'hex-dump' || job == 'disassembly') {
		memSnapshot = mem;
		showTextExport('', '', job);
	}
	else {
		showTextExport('Portable BASIC Listing', Utils.basic2Txt(mem, 0x401) || '-- no program found --');
	}
}

function showTextExport(title, txt, job) {
	var el = document.getElementById('textexport'),
		ta = document.getElementById('textclipboard'),
		ti = document.getElementById('textexportTitle'),
		me = document.getElementById('memexportCtrl');
	if (el && ta) {
		saveScrollState();
		ta.value = txt;
		if (title) {
			ti.innerHTML = title;
			ti.hidden = false;
		}
		else {
			ti.hidden = true;
		}
		if (job) {
			adjustSelect('memexportType', job);
			document.getElementById('memexportStart').value = '0000';
			document.getElementById('memexportEnd').value = (memSnapshot.length-1).toString(16).toUpperCase();
			me.hidden = false;
		}
		else {
			me.hidden = true;
		}
		el.hidden = false;
		if (!me.hidden) {
			var fld = document.getElementById('memexportStart');
			fld.select();
			fld.focus();
		}
		else {
			ta.select();
			ta.focus();
		}
		PetKeys.disable(true);
		var content = document.getElementById('textexportContent');
		content.style.marginTop = Math.max(2, Math.floor((window.innerHeight - content.offsetHeight) / 2)) + 'px';
	}
	else {
		return txt;
	}
}

var memSnapshot = [];

function updateTextExport() {
	function to4DigitsHex(n) {
		s = n.toString(16).toUpperCase();
		while (s.length < 4) s = '0'+s;
		return s;
	}
	var select = document.getElementById('memexportType'),
		ta = document.getElementById('textclipboard'),
		ctrlStart = document.getElementById('memexportStart'),
		ctrlEnd = document.getElementById('memexportEnd'),
		start = parseInt(ctrlStart.value, 16),
		end = parseInt(ctrlEnd.value, 16);
	// set bounds to either RAM or ROM ranges (defaults to full RAM range)
	if (!isNaN(start) && start >= ROM_ADDR) {
		var loROMbtm = ROM_ADDR,
			loROMtop = IO_ADDR - 1,
			hiROMbtm = IO_ADDR + IO_SIZE,
			hiROMtop = 0xFFFF;
		if (memSnapshot.length < ROM_ADDR) {
			for (var i = loROMbtm; i <= loROMtop; i++ ) memSnapshot[i] = pet2001.hw.read(i);
			for (var i = hiROMbtm; i <= hiROMtop; i++ ) memSnapshot[i] = pet2001.hw.read(i);
		}
		if (start > hiROMtop || (start > loROMtop && start < hiROMbtm)) start = hiROMbtm;
		if (start <= loROMtop) {
			if (isNaN(end) || end <= start || end > loROMtop) end = loROMtop;
		}
		else {
			if (isNaN(end) || end <= start || end > hiROMtop) end = hiROMtop;
		}
	}
	else {
		var maxRAM = pet2001.hw.getRamSize()-1;
		if (isNaN(start) || start > maxRAM) start = 0;
		if (isNaN(end) || end < start || end > maxRAM) end = maxRAM;
	}
	// update controls
	ctrlStart.value = to4DigitsHex(start);
	ctrlEnd.value = to4DigitsHex(end);
	// update output
	switch(select.options[select.selectedIndex].value) {
		case 'hex-dump':
			ta.value = Utils.hexDump(memSnapshot, start, end); break;
		case 'disassembly':
			ta.value = Utils.disassemble(memSnapshot, start, end); break;
	}
	ta.select();
	ta.focus();
}

function hideTextExport() {
	var el =  document.getElementById('textexport');
	if (el) {
		el.hidden = true;
		el.value='';
	}
	memSnapshot.length = 0;
	PetKeys.disable(false);
	restoreScrollState();
}

function exportScreenText(asHexDump, asBasicSrc) {
	if (asBasicSrc) {
		exportScreenAsProgram();
		return;
	}
	showTextExport('Screen Contents', pet2001.video.exportText(asHexDump));
}

function exportScreenAsProgram() {
	var el = document.getElementById('srcexport'),
		panel = document.getElementById('srcexportContent');
	if (el && panel) {
		Utils.ScreenGenerator.load(pet2001.video.vidram);
		PetKeys.disable(true);
		saveScrollState();
		el.hidden = false;
		generateScreenAsProgram();
		panel.style.marginTop = Math.max(2, Math.floor((panel.offsetParent.offsetHeight - panel.offsetHeight) / 2) - 32) + 'px';
	}
}

function generateScreenAsProgram() {
	var ta = document.getElementById('srcexportClipboard'),
		elLineNumber = document.getElementById('srcexportLineNumber'),
		elLineStep = document.getElementById('srcexportLineStep'),
		elUpperCase = document.getElementById('srcexportUpperCase'),
		elTrim = document.getElementById('srcexportTrim'),
		lineNumber, step, toUpperCase, trim;
	if (elLineNumber) {
		lineNumber = elLineNumber.value.replace(/\..*/, '').replace(/[^0-9]/g, '');
		lineNumber = parseInt(lineNumber);
		if (!lineNumber || isNaN(lineNumber)) lineNumber = 1000;
		elLineNumber.value = lineNumber;
	}
	if (elLineStep) {
		step = elLineStep.value.replace(/\..*/, '').replace(/[^0-9]/g, '');
		step = parseInt(step);
		if (!step || isNaN(step)) step = 10;
		elLineStep.value = step;
	}
	toUpperCase = elUpperCase? elUpperCase.checked:true;
	trim = elTrim? elTrim.checked:true;
	ta.value = Utils.ScreenGenerator.generate(lineNumber, step, toUpperCase, trim);
	ta.select();
	ta.focus();
}

function hideScreenAsProgram() {
	Utils.ScreenGenerator.unload();
	document.getElementById('srcexport').hidden=true;
	PetKeys.disable(false);
	restoreScrollState();
}

function showScreenshot(withMargins) {
	var dataUrl = pet2001.video.exportImage(withMargins);
	if (dataUrl) showImageExport(dataUrl);
}

function showHardCopy(rasterSize, dotSize) {
	var dataUrl = pet2001.video.exportHardCopy(rasterSize, dotSize);
	if (dataUrl) showImageExport(dataUrl);
}

function showImageExport(dataUrl) {
	var el = document.getElementById('imgexport'),
		parentEl = document.getElementById('imgexportRoot');
	if (el && parentEl) {
		while (parentEl.firstChild) parentEl.removeChild(parentEl.firstChild);
		var img = new Image();
		img.src = dataUrl;
		parentEl.appendChild(img);
		PetKeys.disable(true);
		saveScrollState();
		el.hidden = false;
		img.onload = function() {
			var content = document.getElementById('imgexportContent');
			content.style.marginTop = Math.max(2, Math.floor((window.innerHeight - content.offsetHeight) / 2)) + 'px';
		};
	}
}

function hideImageExport() {
	document.getElementById('imgexport').hidden=true;
	PetKeys.disable(false);
	restoreScrollState();
}

function enableDragAndDropLoader(el) {
	function dropStart(event) {
		stopEvent(event);
		el.className = 'dragdrop';
	}
	function dropEnd(event) {
		stopEvent(event);
		el.className='';
	}
	function stopEvent(event) {
		event.preventDefault();
		event.returnValue = false;
	}
	function dropHandler(event) {
		dropEnd(event);
		if (event.dataTransfer.files.length) {
			var file = event.dataTransfer.files[0], formatFound = false;
			if ((/\.(pro?g|pet)$/i).test(file.name)) {
    			pet2001.reset();
				loadFile(file, autoLoad);
				showDirectoryButton(false);
				formatFound = true;
			}
			else if ((/\.d64$/i).test(file.name)) {
				var fname = file.name;
				if (fname.indexOf('\\')) fname=fname.replace(/^.*\\/,'');
				if (fname.indexOf('/')) fname=fname.replace(/^.*\//,'');
				Utils.D64.readDiskImage(file, fname);
				formatFound = true;
			}
			else if ((/\.(te?xt|bas?)$/i).test(file.name)) {
    			pet2001.reset();
				loadFile(file, function() {autoLoad('*', false);});
				showDirectoryButton(false);
				formatFound = true;
			}
			if (formatFound) {
				try { // reset html file input (just in case)
					document.getElementById('loadfile').value = '';
				}
				catch(ex) {}
			}
		}
	}
	if (el && typeof FileReader !== 'undefined') {
		el.addEventListener('dragover', stopEvent, false);
		el.addEventListener('dragenter', dropStart, false);
		el.addEventListener('dragleave', dropEnd, false);
		el.addEventListener('drop', dropHandler, false);
	}
}

function autoLoad(fname, run) {
	waitForCursor(function() {autoRun(fname, run);});
}

function autoRun(fname, run) {
	var cmds = ['load "' + (fname? fname.toLowerCase() : '*') + '",8'];
	if (run !== false) cmds.push('run');
	PetKeys.type(cmds);
	var el = document.getElementById('petvid');
	if (el && el.focus) el.focus();
}

// wait for the cursor to become active

function waitForCursor(callback) {
	var hw = pet2001.hw, cursorOnFlag = pet2001.getRomVers() == 1? 548:167;
	function waitForIt() {
		if (hw.read(cursorOnFlag)) setTimeout(waitForIt, 20);
		else if (typeof callback === 'function') callback();
	}
	waitForIt();
}

// d64 directories (NL, 2017)

var dirList;

function displayDirectoryList(dir, diskName) {
	if (!dir || dir.length == 0) {
		console.warn('no directory information available.');
		return;
	}
	var displayPane = document.getElementById('diskdirectory'),
		list = document.getElementById('directoryList'),
		title = document.getElementById('directoryTitle');
	if (!displayPane || !list) return;
	while (list.firstChild) list.removeChild(list.firstChild);
	dirList = [];
	for (var i=0; i<dir.length; i++) {
		var e = dir[i],
			li = document.createElement('li'),
			input = document.createElement('input'),
			label = document.createElement('label'),
			name = document.createElement('span'),
			size = document.createElement('span');
		input.type = 'radio';
		input.name = 'directoryItemSelection';
		input.id = '_directoryItem_' + i;
		input.value = i;
		label.setAttribute('for', input.id);
		name.className = 'directoryListName';
		name.innerText = e.name;
		size.className = 'directoryListSize';
		size.innerText = e.size + ' K';
		label.appendChild(name);
		label.appendChild(size);
		li.className = 'directoryListItem '+ (i %2 ?
			'directoryListItemOdd' : 'directoryListItemEven');
		li.appendChild(input);
		li.appendChild(label);
		list.appendChild(li);
		dirList.push(input);
	}
	if (title) title.innerText = diskName;
	adjustSelect('diskdirectory_ram', Math.round(pet2001.getRamSize()/1024));
	saveScrollState();
	displayPane.hidden = false;
	if (list.focus) list.focus();
	showDirectoryButton(true);
}

function loadSelectedDirectoryIndex(autorrun, reset) {
	var index = -1;
	for (var i = 0; i < dirList.length; i++) {
		if (dirList[i].checked) {
			index = i;
			break;
		}
	}
	if (index >= 0) {
		var minRamSelect = document.getElementById('diskdirectory_ram');
		var minRam = minRamSelect? parseInt(minRamSelect.options[minRamSelect.selectedIndex].value):0;
		Utils.D64.loadFile(index, autorrun, reset, minRam);
	}
	closeDirectoryList();
}

function closeDirectoryList() {
	if (dirList) dirList.length = 0;
	var el = document.getElementById('diskdirectory');
	if (el) el.hidden = true;
	restoreScrollState();
}

function showDirectoryButton(v) {
	var el = document.getElementById('directorybutton');
	if (el) el.hidden = !v;
}

// special display for Computer Space 2001

function showCS2001Labels() {
	var el = document.getElementById('petvid');
	if (el) {
		var labels = document.createElement('div');
		labels.id = 'cs2001labels';
		el.appendChild(labels);
	}
}

function hideCS2001Labels() {
	var el = document.getElementById('cs2001labels');
	if (el && el.parentNode) el.parentNode.removeChild(el);
}

// touch-active cursor, position cursor on screen click (NL, 2017)

var cursorbase,
	screenClickMsgShown = true; // disabled for being annoying

function observeScreenClicks(v) {
	var el = document.getElementById('petvid');
	cursorbase = document.getElementById('petscreen');
	if (!el || !cursorbase) return;
	if (v) {
		if (!screenClickMsgShown) {
			alert('Set the cursor position by simply tapping or clicking the screen. \u2014 It is recommended to deactivate this option while running programs, as it may interfere with INPUT statements and other prompts with an active cursor.');
			screenClickMsgShown = true;
		}
		if (typeof el.onpointerdown !== 'undefined') {
			el.addEventListener('pointerdown', screenClick, false);
		}
		else {
			el.addEventListener('mousedown', screenClick, false);
			el.addEventListener('touchstart', screenClick, false);
		}
	}
	else {
		if (typeof el.onpointerdown !== 'undefined') {
			el.removeEventListener('pointerdown', screenClick, false);
		}
		else {
			el.removeEventListener('mousedown', screenClick);
			el.removeEventListener('touchstart', screenClick, false);
		}
	}
}

function screenClick(event) {
	event.preventDefault();
	event.stopPropagation();
	if (PetKeys.busy()) return;

	var hw = pet2001.hw, cursorOnFlag;

	if (pet2001.getRomVers() == 1) {
		cursorOnFlag = 548;
	}
	else  {
		cursorOnFlag = 167;
	}
	if (hw.read(cursorOnFlag) != 0) return;
	
	var	MARGIN = 5,
		bb = cursorbase.getBoundingClientRect(),
		x, y, row, col;
	if (event.type === 'touchstart') {
		var touch = event.touches[0];
		x = touch.pageX;
		y = touch.pageY;
	}
	else {
		x = event.pageX;
		y = event.pageY;
	}
	row = Math.max(0, Math.floor((y-window.pageYOffset-bb.top-MARGIN)/16));
	col = Math.max(0, Math.floor((x-window.pageXOffset-bb.left-MARGIN)/16));
	setCursor(row, col);
}

function setCursor(row, col) {
	var hw = pet2001.hw,
		crsrBlinkFlag, crsrChar, quoteFlag, rvsFlag, insertCnt,
		curScreenLine, curLineCol, startOfLinePtr, maxLineLength,
		lsbVideoTable, hsbVideoTable;

	if (row < 0) row = 0;
	else if (row > 24) row = 24;
	if (col < 0) col = 0;
	else if (col > 39) col = 39;

	if (pet2001.getRomVers() == 1) {
		curScreenLine = 0xF5;
		curLineCol = 0xE2;
		startOfLinePtr = 0xE0;
		maxLineLength = 0xF2;
		hsbVideoTable = 0x0229;
		lsbVideoTable = 0xE7BC;
		crsrBlinkFlag = 0x0227;
		crsrChar = 0x0226;
		quoteFlag = 0xEA;
		insertCnt = 0xFB;
		rvsFlag = 0x020E;
	}
	else {
		curScreenLine = 0xD8;
		curLineCol = 0xC6;
		startOfLinePtr = 0xC4;
		maxLineLength = 0xD5;
		hsbVideoTable = 0xE0;
		lsbVideoTable = 0xE748;
		crsrBlinkFlag = 0xAA;
		crsrChar = 0xA9;
		quoteFlag = 0xCD;
		rvsFlag = 0x9F;
		insertCnt = 0xDC;
	}
	// unblink
	if (hw.read(crsrBlinkFlag)) {
		hw.write(crsrBlinkFlag, 0);
		pet2001.video.forcedWrite(
			hw.read(startOfLinePtr) + (hw.read(startOfLinePtr+1)<<8)
				+ hw.read(curLineCol) - VIDRAM_ADDR,
			hw.read(crsrChar)
		);
	}
	// clear input mode flags
	hw.write(quoteFlag, 0);
	hw.write(rvsFlag, 0);
	hw.write(insertCnt, 0);
	// is target row a long line (more than 40 chars)?
	if (row > 0 && (hw.read(hsbVideoTable + row) & 0x80) == 0) {
		row--;
		col += 40;
	}
	// set cursor like ROM routine
	// compare 0xE5DB (ROM1) and 0xE25D (ROM2)
	hw.write(curScreenLine, row);
	hw.write(startOfLinePtr+1, hw.read(hsbVideoTable+row) | 0x80);
	hw.write(startOfLinePtr, hw.read(lsbVideoTable+row));
	if (row < 24 && (hw.read(hsbVideoTable+1+row) & 0x80) == 0) {
		hw.write(maxLineLength, 79);
	}
	else {
		hw.write(maxLineLength, 39);
	}
	// as in ROM, won't work for long lines
	/*
	if (col>=40) {
		hw.write(curLineCol, col-40);
	}
	else {
		hw.write(curLineCol, col);
	}
	*/
	// since we compensated for long lines above, write col as-is
	hw.write(curLineCol, col);
}

// prg-library

function showPrgLibrary(url, separateWindow) {
	if (separateWindow) {
		window.open(url);
		return;
	}
	var el = document.getElementById('prglibrary'),
		iframe = document.getElementById('prglibrary_contents');
	if (!el || !iframe) return;
	saveScrollState();
	var ts = Math.floor(Date.now() / 1800000).toString(36); // refresh every half hour
	if (!iframe.src || !(iframe.src.match('\\?ts='+ts+'\\b') || (navigator.onLine === false))) {
		if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) iframe.parentNode.className = 'ios';
		iframe.src = url+'?ts='+ts;
	}
	el.hidden = false;
	if (iframe.focus) iframe.focus();
}

function prgLibraryScrollToYiOS(y) {
	var iframe = document.getElementById('prglibrary_contents');
	if (iframe) iframe.parentNode.scrollTop = y || 0;
}

function hidePrgLibrary() {
	document.getElementById('prglibrary').hidden = true;
	restoreScrollState(true);
}

function loadFromPrgLibrary(params) {
	hidePrgLibrary();
	resetButton();
	waitForCursor(function() { parseSetupParams(params); });
}

// check url parameters on start up (NL, 2017)

function parseSetupParams(query) {
	var prgPath = './prgs/',
		defaultExtension = '.prg',
		matches;
	// set rom version
	matches = (/[?&]rom=([12])\b/i).exec(query);
	if (matches) {
		setRomVersion(
			matches[1],
			function() {parseSetupParams(query.replace(/([?&])rom=[^&]*&?/gi, '$1'))}
		);
		return;
	}
	// set ram size
	matches = (/[?&]ram=([0-9]+)/i).exec(query);
	if (matches) {
		setRamSize(
			parseInt(matches[1].toLowerCase(),10),
			function() {parseSetupParams(query.replace(/([?&])ram=[^&]*&?/gi, '$1'))}
		);
		return;
	}
	// set color
	matches = (/[?&](?:clr|colou?r|screen)=([^&]+)/i).exec(query);
	if (matches) {
		var clr = matches[1].toLowerCase(),
			el = document.getElementById('screencolor');
		if (el) {
			if (clr === 'blue') clr = 'white';
			for (var i = 0; i < el.options.length; i++) {
				if (el.options[i].value == clr) {
					setColor(matches[1]);
					el.selectedIndex = i;
					break;
				}
			}
		}
	}
	// set keyboard repeat
	matches = (/[?&]((keyboard|kbd)(mode)?=(norepeat|games?|gaming)|(key)?repeat=(no|0|off|false))/i).exec(query);
	if (matches) {
		setKeyRepeat(false);
		adjustSelect('keyrepeat', 'false');
	}
	// load program from url
	matches = (/[?&](prg|prog|progr|program|run|load)=([^&]+)/i).exec(query);
	if (matches) {
		var	run = matches[1] == 'run',
			fileName = unescape(matches[2]).replace(/[^\u0020-\u00ff]/g, '').replace(/\\/g, '').replace(/^[\/\.]+/, ''),
			parts = fileName.split('/'), dirName;
		if ((/\.d64$/i).test(parts[0])) {
			dirName=parts[0];
			if (dirName) {
				fileName='';
				for (var i=1; i<parts.length; i++) {
					var p = parts[i].replace(/^\.+/, '');
					if (p) {
						fileName=p;
						break;
					}
				}
				D64.loadDiskImage(dirName, fileName);
			}
		}
		else {
			fileName=parts[0];
			if (fileName) {
				var sysName = fileName.replace(/\.\w+$/, '');
				if (fileName == sysName) fileName += defaultExtension;
				var xhr = new XMLHttpRequest();
				xhr.open('GET', prgPath + encodeURIComponent(fileName) + '?uid=' + Date.now().toString(36), true);
				if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
				if (xhr.overrideMimeType) xhr.overrideMimeType('text/plain; charset=x-user-defined');
				xhr.onload = function xhr_onload() {
					if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
						if ((/\.(te?xt|bas?)$/i).test(fileName)) {
							var parsed = Utils.txt2Basic(xhr.response);
							if (parsed.error) alert('Parse Error\n'+parsed.error);
							else {
								pet2001.ieeeLoadData(0x401, parsed.prg);
								autoLoad(sysName, run);
							}
						}
						else {
							var	data = new DataView(xhr.response);
								size = data.byteLength,
								addr = data.getUint8(0) + data.getUint8(1) * 256,
								bytes = Array(size - 2);
							for (var i = 0; i < size - 2; i++) bytes[i] = data.getUint8(i + 2);
							pet2001.ieeeLoadData(addr, bytes);
							autoLoad(sysName);
							if ((/^computerspace2001$/i).test(sysName)) showCS2001Labels();
						}
					}
					else {
						xhr.onerror();
					}
				}
				xhr.onerror = function xhr_onerror() {
					var msg = 'PET: Unable to load file "'+fileName+'"';
					if (xhr.status) msg += ' ('+xhr.status+')';
					msg +=  (xhr.statusText? ': '+xhr.statusText:'.');
					console.warn(msg);
				}
				xhr.send(null);
			}
		}
	}
	// load disk image from url
	matches = (/[?&](?:disk|dsk|floppy|d64)=([^&]+)/i).exec(query);
	if (matches) {
		var	fileName = unescape(matches[1]).replace(/[^\u0020-\u00ff]/g, '').replace(/\\/g, ''),
			parts = fileName.split('/'), dirName;
		if ((/\.d64$/i).test(parts[0])) {
			dirName=parts[0];
			fileName='';
			for (var i=1; i<parts.length; i++) {
				if (parts[i]) {
					fileName=parts[i];
					break;
				}
			}
			Utils.D64.loadDiskImage(dirName, fileName);
			return;
		}
	}
}

parseSetupParams(window.location.search);
