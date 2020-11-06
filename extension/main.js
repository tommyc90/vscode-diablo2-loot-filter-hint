const vscode = require('vscode');
const hintDataManager = require('./hintDataManager');

const DOCUMENT_SELECTOR = [hintDataManager.FILTER_TYPE_POD, hintDataManager.FILTER_TYPE_PD2];

/**
 * @param {any} document
 * @param {any} position
 * @returns {string}
 */
function getTextAtCursor(document, position) {
    const range = new vscode.Range(position, new vscode.Position(position.line, position.character + 1));
	return document.getText(range);
}

/**
 * @param {any} document
 * @param {any} position
 * @returns {string}
 */
function getTextBeforeCursor(document, position) {
	var start = new vscode.Position(position.line, 0);
	var range = new vscode.Range(start, position);
	return document.getText(range);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasTextComment(text = '') {
    return text.match(/\/\//);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextInCondition(text = '') {
    return text.match(/^ItemDisplay\[[^\]]*$/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextInAction(text = '') {
    return text.match(/^ItemDisplay\[[^\]]*\]:/);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTextPossibleKeyword(text = '') {
    return text.match(/^[A-Z0-9_-]+$/);
}

function activate(context) {
    let subscriptions = context.subscriptions
    let disposable = [];

    // completion provider
    disposable[0] = vscode.languages.registerCompletionItemProvider(DOCUMENT_SELECTOR, {
        provideCompletionItems: (document, position) => {
            const textBeforeCursor = getTextBeforeCursor(document, position);
            if (hasTextComment(textBeforeCursor)) {
                return null;
            }

            hintDataManager.init(document.languageId);

            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);

            if (isTextInCondition(textBeforeCursor)) {
                return isTextPossibleKeyword(word) ? hintDataManager.getCompletionConditionKeywords() : hintDataManager.getCompletionItems();
            }

            if (isTextInAction(textBeforeCursor)) {
                return isTextPossibleKeyword(word) ? hintDataManager.getCompletionActionKeywords() : null;
            }

            return null;
        }
    });

    // hover provider
	disposable[1] = vscode.languages.registerHoverProvider(DOCUMENT_SELECTOR, {
		provideHover: (document, position) => {
            // ignore non-alphanumeric character
            const char = getTextAtCursor(document, position);
            if (!char.match(/\w/)) {
                return null;
            }
            const textBeforeCursor = getTextBeforeCursor(document, position);
            if (hasTextComment(textBeforeCursor)) {
                return null;
            }

            hintDataManager.init(document.languageId);

            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);

            let hover = null;
            if (isTextInCondition(textBeforeCursor)) {
                hover = hintDataManager.getConditionHoverItem(word);
            }

            if (isTextInAction(textBeforeCursor)) {
                hover = hintDataManager.getActionHoverItem(word);
            }

            // return clone to avoid positioning bug
            return hover ? {...hover} : null;
        }
    });
    
    subscriptions.push(...disposable);
}

function deactivate() { }

exports.activate = activate;
exports.deactivate = deactivate;