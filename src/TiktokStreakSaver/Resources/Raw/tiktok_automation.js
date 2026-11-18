// TikTok Message Automation Script (Search Bar Version)
// This script is injected into the TikTok WebView to automate messaging via search bar

(function () {
    var userName = '[UserName]';
    var message = '[Message]';
    var isGroup = '[IsGroup]' === 'true';

    var log = function (msg) {
        if (typeof StreakApp == 'undefined') {
            console.log(msg);
            return;
        }
        StreakApp.log(msg);
    };

    // ── Result Reporting ─────────────────────────────────────────────────────

    var reportSuccess = function () {
        log('[RESULT] SUCCESS — Message sent to ' + userName);
        if (typeof StreakApp !== 'undefined') {
            StreakApp.onMessageSent(userName, true, '');
        }
    };

    var reportError = function (errorMessage) {
        log('[RESULT] FAIL — ' + errorMessage);
        if (typeof StreakApp !== 'undefined') {
            StreakApp.onMessageSent(userName, false, errorMessage);
        }
    };

    // ── Message Input & Sending ──────────────────────────────────────────────

    var findMessageInput = function () {
        var editor = document.querySelector('[class*="DraftEditor-editorContainer"] [contenteditable="true"]') ||
            document.querySelector('[class*="DraftEditor-root"] [contenteditable="true"]') ||
            document.querySelector('div[contenteditable="true"][role="textbox"]') ||
            document.querySelector('div[contenteditable="true"]');

        return editor;
    };

    var findDraftEditor = function (messageInput) {
        var key = Object.keys(messageInput).find(function (k) {
            return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
        });

        if (!key) return null;
        var fiber = messageInput[key];
        var current = fiber;

        while (current) {
            if (current.stateNode && current.stateNode.editor) {
                return current.stateNode;
            }
            current = current.return;
        }
        return null;
    };

    var typeMessage = function (messageInput, callback) {
        log('[TYPE] Starting typeMessage...');
        var draftEditor = findDraftEditor(messageInput);

        if (draftEditor) {
            draftEditor.focus();
            setTimeout(function () {
                var dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', message);

                var pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                });

                try {
                    draftEditor._onPaste(pasteEvent);
                } catch (e) {
                    log('[TYPE] _onPaste error: ' + e.message);
                }

                setTimeout(callback, 300);
            }, 200);
        } else {
            messageInput.click();
            messageInput.focus();
            setTimeout(function () {
                var selection = window.getSelection();
                var range = document.createRange();
                range.selectNodeContents(messageInput);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);

                document.execCommand('insertText', false, message);
                setTimeout(callback, 300);
            }, 200);
        }
    };

    var sendMessage = function (messageInput) {
        var sendBtn = document.querySelector('[data-e2e*="send"]') ||
            document.querySelector('[data-e2e*="Send"]') ||
            document.querySelector('button[type="submit"]');

        if (sendBtn) {
            sendBtn.dispatchEvent(new Event('click', { bubbles: true }));
            return;
        }

        messageInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        messageInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    };

    var processChatAndSend = function () {
        setTimeout(function () {
            var messageInput = findMessageInput();
            if (messageInput) {
                log('[CHAT] Found message input, typing...');
                typeMessage(messageInput, function () {
                    sendMessage(messageInput);
                    setTimeout(reportSuccess, 1000);
                });
            } else {
                log('[CHAT] Message input not found');
                reportError('Message input not found');
            }
        }, 1500);
    };

    // ── Search Bar Interaction ───────────────────────────────────────────────

    var searchAndOpenUser = function () {
        if (userName.startsWith('@')) {
            userName = userName.substring(1);
        }

        log('[SEARCH] Looking for search input bar...');
        
        // البحث عن حقل إدخال البحث العلوي في صفحة الرسائل (Inbox Search)
        var searchInput = document.querySelector('input[type="text"][placeholder*="Account"], input[type="text"][placeholder*="بحث"], input[type="search"], [contenteditable="true"][data-e2e*="search"], input[placeholder*="Account and messages"]');
        
        // محاولة بديلة عامة لو لم يتم العثور عليه بالشكل الدقيق
        if (!searchInput) {
            var inputs = document.querySelectorAll('input');
            for (var i = 0; i < inputs.length; i++) {
                var ph = (inputs[i].getAttribute('placeholder') || '').toLowerCase();
                if (ph.includes('account') || ph.includes('message') || ph.includes('search') || ph.includes('بحث')) {
                    searchInput = inputs[i];
                    break;
                }
            }
        }

        if (!searchInput) {
            log('[SEARCH] ERROR: Search input bar not found!');
            reportError('Search input bar not found');
            return;
        }

        log('[SEARCH] Search input found. Focusing and typing: ' + userName);
        searchInput.click();
        searchInput.focus();

        // كتابة الاسم داخل شريط البحث
        searchInput.value = userName;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));

        // الانتظار حتى تظهر نتائج البحث في القائمة المنسدلة
        setTimeout(function () {
            log('[SEARCH] Searching for results in dropdown...');
            
            // البحث عن العناصر الناتجة في قائمة البحث (سواء محادثة أو مجموعة أو مستخدم)
            var results = document.querySelectorAll("[data-e2e*='conversation-item'], [data-e2e*='chat-item'], [class*='ConversationItem'], [class*='user-item'], div[role='listitem']");
            
            if (results.length === 0) {
                // محاولة عثور بديلة على العناصر داخل قائمة نتائج البحث
                results = document.querySelectorAll('a[href*="/@"], [class*="Item"], [class*="result"]');
            }

            if (results && results.length > 0) {
                log('[SEARCH] Found ' + results.length + ' result(s), clicking the first match...');
                results[0].click();
                processChatAndSend();
            } else {
                log('[SEARCH] WARNING: No search results found for: ' + userName);
                reportError('User or group not found in search results');
            }
        }, 2000);
    };

    // بدء التنفيذ
    setTimeout(function () {
        searchAndOpenUser();
    }, 2000);

})();
