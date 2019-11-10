var PetKeys = (function() {

    var petkeysDisabled = false,
        ignoreEsc = false,
        noRepeat = false;
    var keyrows = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
    var keyboardElement = document.getElementById('petkey');

    // changes for visible feeback and shiftkey-support; NL 2017
    var isShift = false,
        keyMask, shiftMask, isKeyDown = false,
        lastKeyCode = 0;

    (function init() {
        keyMask = document.createElement('div');
        keyMask.style.position = 'absolute';
        keyMask.style.backgroundColor = 'rgba(0,0,0,0.225)';
        keyMask.style.pointerEvents = 'none';
        keyMask.style.padding = '0';
        keyMask.style.margin = '0';
        keyMask.style.zIndex = 1000;
        shiftMask = document.createElement('div');
        shiftMask.style.position = 'absolute';
        shiftMask.style.width = shiftMask.style.height = '35px';
        shiftMask.style.backgroundColor = 'rgba(0,0,0,0.225)';
        shiftMask.style.pointerEvents = 'none';
        shiftMask.style.padding = '0';
        shiftMask.style.margin = '0';
        shiftMask.style.zIndex = 1000;
    })();

    function setKeyMask(row, col, ignoreShift) {
        var isShiftKey = (row == 4 && (col == 0 || col == 10)),
            isCursor = (row == 0 && (col == 13 || col == 14)),
            mask = isShiftKey ? shiftMask : keyMask;
        document.body.appendChild(mask);
        if (isShiftKey) {
            isShift = !isShift;
        } else {
            if (row == 4 && (col == 5 || col == 6)) { // space key
                mask.style.width = '96px';
                if (col == 6) col--;
            } else {
                mask.style.width = '33px';
            }
            if ((row == 2 || row == 3) && col == 10) { // return key
                mask.style.height = '96px';
                if (row == 3) row--;
            } else {
                mask.style.height = '33px';
            }
            if (!ignoreShift && isShift && !isCursor) setTimeout(releaseShiftKey, 0);
        }
        mask.style.left = Math.floor(keyboardElement.offsetLeft + 130 + col * 34) + 'px';
        mask.style.top = Math.floor(keyboardElement.offsetTop + 50 + row * 34) + 'px';
    }

    function releaseKeyMask(ignoreShift) {
        if (keyMask.parentNode) keyMask.parentNode.removeChild(keyMask);
        if (!ignoreShift && !isShift && shiftMask.parentNode) shiftMask.parentNode.removeChild(shiftMask);
    }

    function releaseShiftKey() {
        isShift = false;
        if (shiftMask.parentNode) shiftMask.parentNode.removeChild(shiftMask);
    }

    function reset() {
        if (petkeyKeypressTimeoutHandle) clearTimeout(petkeyKeypressTimeoutHandle);
        petkeyKeypressTimeoutHandle = null;
        petkeyKeyQueue.length = 0;
        if (autoTypeTimer) clearTimeout(autoTypeTimer);
        isShift = false;
        kbdTouches = {};
        petkeyReleaseAll();
    }

    function petSetShiftKey(down, right) {
        var bit = (right) ? 0x20 : 0x01;
        if (down)
            keyrows[8] &= 0xff - bit;
        else
            keyrows[8] |= bit;
        pet2001.setKeyrows(keyrows);
    }

    // end of edit

    function petKeypress(col, row, shift) {
        // Press the key
        if ((col & 1) != 0)
            keyrows[row * 2 + 1] &= ~(1 << (col >> 1));
        else
            keyrows[row * 2] &= ~(1 << (col >> 1));

        // Press the left shift key if shift.
        if (shift)
            keyrows[8] = (keyrows[8] | 0x20) & 0xfe;
        else
            keyrows[8] |= 0x21;

        // Space key is a double-wide and return is double-height
        if (row == 4 && col == 5)
            keyrows[8] &= 0xf7;
        else if (row == 4 && col == 6)
            keyrows[9] &= 0xfb;
        else if (row == 2 && col == 10)
            keyrows[6] &= 0xdf;
        else if (row == 3 && col == 10)
            keyrows[4] &= 0xdf;

        pet2001.setKeyrows(keyrows);
    }

    function petKeyrelease(col, row, shift) {
        // Release the key
        if ((col & 1) != 0)
            keyrows[row * 2 + 1] |= 1 << (col >> 1);
        else
            keyrows[row * 2] |= 1 << (col >> 1);

        // Release the both shift keys if shift.
        if (shift)
            keyrows[8] |= 0x21;

        // Space key is a double-wide and return is double-height.
        if (row == 4 && col == 5)
            keyrows[8] |= 0x08;
        else if (row == 4 && col == 6)
            keyrows[9] |= 0x04;
        else if (row == 2 && col == 10)
            keyrows[6] |= 0x20;
        else if (row == 3 && col == 10)
            keyrows[4] |= 0x20;

        pet2001.setKeyrows(keyrows);
    }

    // Call this to clear all keys
    //
    function petkeyReleaseAll() {
        for (var i = 0; i < 10; i++)
            keyrows[i] = 0xff;

        pet2001.setKeyrows(keyrows);
        releaseKeyMask(); // NL 2017
    }
    //////////////////////////// Mouse Events /////////////////////////////////

    // onMouseDown event handler.
    //
    function petkeyOnMouseDown(img, event) {
        var x, y;

        if (event.pageX || event.pageY) {
            x = event.pageX;
            y = event.pageY;
        } else {
            x = event.clientX + document.body.scrollLeft +
                document.documentElement.scrollLeft;
            y = event.clientY + document.body.scrollTop +
                document.documentElement.scrollTop;
        }
        x -= img.offsetLeft;
        y -= img.offsetTop;
        // alert(x);
        // alert(y);
        if (((x >= 130 && x < 500) || (x >= 535 && x < 680)) &&
            (y >= 50 && y < 215)) {
            var col = Math.floor((x - 130) / 35);
            var row = Math.floor((y - 50) / 35);

            setKeyMask(row, col); // NL 2017
            petKeypress(col, row, event.shiftKey || isShift);
            isKeyDown = true;
        }
    }

    function petkeyOnMouseUp(img, event) {
        petkeyReleaseAll();
        isKeyDown = false;
    }

    ////////////////////////////// Touch events ///////////////////////////////
    // mod. NL, 2017
    var kbdTouches = {};
    keyboardElement.addEventListener('touchstart', function(event) {
        if (noRepeat) { // immediate multitouch
            if (event.changedTouches) {
                for (var i = 0; i < event.changedTouches.length; i++) {
                    var touch = event.changedTouches[i],
                        id = touch.identifier;
                    if (!kbdTouches[id]) {
                        var x = touch.pageX - keyboardElement.offsetLeft;
                        var y = touch.pageY - keyboardElement.offsetTop;
                        if (((x >= 130 && x < 500) || (x >= 535 && x < 680)) &&
                            (y >= 50 && y < 215)) {
                            var col = Math.floor((x - 130) / 35);
                            var row = Math.floor((y - 50) / 35);
                            var isShiftKey = (row == 4 && (col == 0 || col == 10));
                            kbdTouches[id] = { row: row, col: col, shift: isShiftKey };
                            setKeyMask(row, col, true);
                            petKeypress(col, row, isShift || isShiftKey);
                        }
                    }
                }
            }
        } else { // keyboard-like interaction
            var touch = event.touches[0];
            var x = touch.pageX - keyboardElement.offsetLeft;
            var y = touch.pageY - keyboardElement.offsetTop;
            // console.log("onTouchStart() called! x=%d y=%d", x, y);

            if (((x >= 130 && x < 500) || (x >= 535 && x < 680)) &&
                (y >= 50 && y < 215)) {
                var col = Math.floor((x - 130) / 35);
                var row = Math.floor((y - 50) / 35);
                setKeyMask(row, col);
                petKeypress(col, row, isShift);
            }
        }
        event.preventDefault();
    }, false);

    keyboardElement.addEventListener('touchend', function(event) {
        if (noRepeat && event.changedTouches) { // immediate multitouch
            for (var i = 0; i < event.changedTouches.length; i++) {
                var id = event.changedTouches[i].identifier,
                    t = kbdTouches[id];
                if (t) {
                    petKeyrelease(t.col, t.row, isShift ||  t.shift);
                    if (t.shift) {
                        releaseShiftKey();
                    } else {
                        releaseKeyMask(true);
                    }
                    delete kbdTouches[id];
                }
            }
        } else {
            petkeyOnMouseUp();
        }
        event.preventDefault();
    }, false);

    ///////////////////////////// Keyboard events ////////////////////////////
    // mod NL 2017 for esc (ASCII 27) = stop key
    var ascii_to_pet_row = [-1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4, 4, 1,
        4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 2, 3, 4, 4, 4, 3,
        4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 0, 4, -1, -1, -1, 2, 3, 3, 2, 1, 2, 2, 2, 1, 2, 2, 2, 3, 3, 1,
        1, 1, 1, 2, 1, 1, 3, 1, 3, 1, 3, -1, -1, -1, -1, -1,
    ];
    var ascii_to_pet_col = [-1, -1, -1, -1, -1, -1, -1, -1, 15, -1, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, -1, -1, -1, -1,
        6, 0, 1, 2, 3, 4, 6, 5, 8, 9, 15, 15, 7, 14, 13, 15,
        12, 12, 13, 14, 12, 13, 14, 12, 13, 14, 9, 8, 7, 15, 8, 9,
        2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 3, 7, 4, -1, -1, -1, 0, 4, 2, 2, 2, 3, 4, 5, 7, 6, 7, 8, 6, 5, 8,
        9, 0, 3, 1, 4, 6, 3, 1, 1, 5, 0, -1, -1, -1, -1, -1,
    ];

    var petkeyKeypressTimeoutHandle = null,
        petkeyKeypressTimeoutDelay = 40,
        petkeyKeyQueue = [],
        autoTypeDelay = 66,
        autoTypeTimer;

    function petkeyKeypressTimeout() {
        petkeyReleaseAll();

        // Are there queued keypresses?	 Press and set another timeout.
        if (petkeyKeyQueue.length > 0) {
            var codes = petkeyKeyQueue.shift();
            if (codes)
                petKeypress(codes[0], codes[1], codes[2]);

            petkeyKeypressTimeoutHandle =
                setTimeout(petkeyKeypressTimeout, petkeyKeypressTimeoutDelay);
        } else
            petkeyKeypressTimeoutHandle = null;
    }

    // onKeyPress event handler. (mod NL)
    //
    function petkeyOnKeyPress(event) {

        if (petkeysDisabled || event.metaKey || event.ctrlKey)
            return true;

        var code = event.charCode != 0 ? event.charCode : event.keyCode,
            shift = false;
        if (code == 27) { // esc mapped to run/stop
            if (ignoreEsc) return true;
            shift = event.shiftKey;
        } else if (event.shiftKey && code >= 0x41 && code <= 0x5a) {
            // transform A-Z to SHIFT a-z
            code += 0x20;
            shift = true;
        }

        if (code > 0 && code < 128 && ascii_to_pet_row[code] >= 0)
            petKeyAction(ascii_to_pet_col[code], ascii_to_pet_row[code], shift);

        event.returnValue = false;
        return false;
    }

    function petKeyAction(col, row, shift) {
        if (noRepeat) {
            petKeypress(col, row, shift);
        } else if (petkeyKeypressTimeoutHandle == null) {
            // No.	Press key and set timeout.
            petKeypress(col, row, shift);

            petkeyKeypressTimeoutHandle =
                setTimeout(petkeyKeypressTimeout, petkeyKeypressTimeoutDelay);
        } else {
            // Yes.	 Queue a "blank" to and then the keypress.	The
            // "blank" releases the previous key and is needed when you
            // are pressing the same key again.	 Sometimes, it seems the
            // PET needs it even if you aren't pressing the the same key
            // again so I don't bother comparing with the previous key.
            //
            petkeyKeyQueue.push(0);
            petkeyKeyQueue.push([col, row, shift]);
        }
    }

    // keydown event handler (NL)

    function petkeyOnKeyDown(event) {

        if (petkeysDisabled || event.metaKey || event.ctrlKey)
            return true;
        var keyCode = event.keyCode;
        if (event.keyIdentifier === 'Shift' || event.key === 'Shift' || keyCode === 16) {
            petSetShiftKey(true, (event.location || event.keyLocation) == 2);
            return true;
        }

        if (noRepeat) {
            if (keyCode === lastKeyCode) {
                event.preventDefault();
                event.returnValue = false;
                return false;
            } else if (lastKeyCode !== 0) {
                petkeyReleaseAll();
            }
        }
        if (keyCode && !event.charCode) {
            if (ignoreEsc && keyCode == 27) return true;
            if (keyCode == 8 || keyCode == 9 || (keyCode >= 36 && keyCode <= 40) ||
                keyCode == 45 || keyCode == 46) {
                switch (keyCode) {
                    case 8: // BACKSPACE
                    case 45: // INSERT
                    case 46: // DELETE
                        petKeyAction(15, 0, (keyCode == 45) || event.shiftKey);
                        break;
                    case 9: // TAB => up arrow / TAB + ALT => left arrow
                        petKeyAction(10, event.altKey ? 0 : 1, event.shiftKey);
                        break;
                    case 36: //HOME
                        petKeyAction(12, 0, event.shiftKey);
                        break;
                    case 37: //LEFT
                        petKeyAction(14, 0, true);
                        break;
                    case 38: //UP
                        petKeyAction(13, 0, true);
                        break;
                    case 39: //RIGHT
                        petKeyAction(14, 0, false);
                        break;
                    case 40: //DOWN
                        petKeyAction(13, 0, false);
                        break;
                }
                event.preventDefault();
            }
        }
        lastKeyCode = keyCode;
    }

    function petkeyOnKeyUp(event) {
        if (event.keyIdentifier === 'Shift' || event.key === 'Shift' || event.keyCode === 16) {
            petSetShiftKey(false, (event.location || event.keyLocation) == 2);
            return true;
        }
        if (noRepeat) petkeyReleaseAll();
        lastKeyCode = 0;
    }

    function petkeyOnMouseOut() {
        if (isKeyDown) petkeyOnMouseUp();
    }

    function petkeysDisable(v) {
        petkeysDisabled = Boolean(v);
    }

    function setKeyRepeat(v) {
        noRepeat = !v;
        lastKeyCode = 0;
    }

    var typing = false;

    function autoType(toType) {
        var txt, i = 0;
        if (Object.prototype.toString.call(toType) === '[object Array]') {
            txt = toType.join('\n') + '\n';
        } else {
            txt = String(toType);
        }

        function type() {
            petkeyReleaseAll();
            if (i < txt.length) {
                var cc = txt.charCodeAt(i++);
                if (cc === 10) cc = 13;
                else if (cc === 13 && i < txt.length && txt.charCodeAt(i) === 10) i++;
                petkeyOnKeyPress({ 'charCode': cc });
                autoTypeTimer = setTimeout(type, autoTypeDelay);
            } else {
                typing = false;
            }
        }
        typing = true;
        type();
    }

    function busy() {
        return petkeysDisabled || typing || petkeyKeyQueue.length > 0;
    }

    return {
        'onMouseDown': petkeyOnMouseDown,
        'onMouseUp': petkeyOnMouseUp,
        'onMouseOut': petkeyOnMouseOut,
        'onKeyPress': petkeyOnKeyPress,
        'onKeyDown': petkeyOnKeyDown,
        'onKeyUp': petkeyOnKeyUp,
        'disable': petkeysDisable,
        'setKeyRepeat': setKeyRepeat,
        'reset': reset,
        'type': autoType,
        'busy': busy,
        // backward compatibile
        'petkeyOnMouseDown': petkeyOnMouseDown,
        'petkeyOnMouseUp': petkeyOnMouseUp,
        'petkeyOnMouseOut': petkeyOnMouseOut,
        'petkeyOnKeyPress': petkeyOnKeyPress,
        'petkeyOnKeyDown': petkeyOnKeyDown,
        'petkeyOnKeyUp': petkeyOnKeyUp
    };

})();