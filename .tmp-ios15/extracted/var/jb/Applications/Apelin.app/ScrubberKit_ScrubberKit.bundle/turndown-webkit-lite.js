; (function (global) {
    if (!global) return;

    function ensureTurndown() {
        if (typeof global.TurndownService === 'function') {
            return global.TurndownService;
        }
        throw new Error('TurndownService is not available. Make sure turndown.js is evaluated first.');
    }

    var defaultService = null;

    function getDefaultService() {
        if (!defaultService) {
            var TurndownService = ensureTurndown();
            defaultService = new TurndownService();
        }
        return defaultService;
    }

    function isNode(input) {
        return input && typeof input === 'object' && typeof input.nodeType === 'number';
    }

    function toArray(value) {
        if (Array.isArray(value)) return value;
        if (value == null) return [];
        return [value];
    }

    function createWorkingRoot(target) {
        if (isNode(target)) {
            return target.cloneNode(true);
        }
        return target;
    }

    function applyRemovals(root, remove) {
        if (!root || !remove) return;
        if (typeof root.querySelectorAll !== 'function') return;

        toArray(remove).forEach(function (selector) {
            if (!selector || typeof selector !== 'string') return;
            var nodes = root.querySelectorAll(selector);
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (node && node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }
        });
    }

    function removeComments(root) {
        if (!root || !root.childNodes) return;
        var child = root.firstChild;
        while (child) {
            var next = child.nextSibling;
            if (child.nodeType === 8 && child.parentNode) {
                child.parentNode.removeChild(child);
            } else if (child.childNodes && child.childNodes.length) {
                removeComments(child);
            }
            child = next;
        }
    }

    function removeBase64Data(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        var allNodes = root.querySelectorAll('*');
        var nodesToRemove = [];
        for (var i = 0; i < allNodes.length; i++) {
            var node = allNodes[i];
            var src = node.getAttribute('src') || '';
            var href = node.getAttribute('href') || '';
            var style = node.getAttribute('style') || '';
            var background = node.getAttribute('background') || '';
            var computedStyle = node.style ? node.style.backgroundImage || node.style.background || '' : '';
            if ((typeof src === 'string' && src.indexOf('data:') === 0) ||
                (typeof href === 'string' && href.indexOf('data:') === 0) ||
                (typeof style === 'string' && style.indexOf('data:') !== -1) ||
                (typeof background === 'string' && background.indexOf('data:') !== -1) ||
                (typeof computedStyle === 'string' && computedStyle.indexOf('data:') !== -1)) {
                nodesToRemove.push(node);
            }
        }
        for (var j = 0; j < nodesToRemove.length; j++) {
            var nodeToRemove = nodesToRemove[j];
            if (nodeToRemove && nodeToRemove.parentNode) {
                nodeToRemove.parentNode.removeChild(nodeToRemove);
            }
        }
    }

    function removeLinkUrls(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        var links = root.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href') || '';
            if (typeof href === 'string' && (href.indexOf('http://') === 0 || href.indexOf('https://') === 0 || href.indexOf('//') === 0)) {
                link.removeAttribute('href');
            }
        }
    }

    function applyScope(root, scope) {
        if (!scope || !root) return root;
        if (typeof scope === 'string') {
            if (typeof root.querySelector === 'function') {
                var match = root.querySelector(scope);
                return match || root;
            }
            return root;
        }
        if (isNode(scope)) return scope;
        return root;
    }

    function prepareTarget(target, config) {
        if (!config || !global.document) return target;

        var workingRoot = createWorkingRoot(target);
        if (!workingRoot || !isNode(workingRoot)) return workingRoot;

        if (config.stripHeadElements) {
            var headSelectors = toArray(config.stripHeadElements);
            if (headSelectors.length) {
                applyRemovals(workingRoot, headSelectors);
            }
        }

        if (config.remove) {
            applyRemovals(workingRoot, config.remove);
        }

        if (config.stripComments) {
            removeComments(workingRoot);
        }

        if (config.removeDataImages) {
            removeBase64Data(workingRoot);
        }

        removeLinkUrls(workingRoot);

        var scopedRoot = config.scope ? applyScope(workingRoot, config.scope) : workingRoot;

        return scopedRoot;
    }

    function getDefaultConfig() {
        return {
            scope: '#results',
            remove: ['style', 'script', 'iframe', 'svg', 'img', 'video', 'audio', 'source', 'track', 'link'],
            stripComments: true,
            removeDataImages: true,
            stripHeadElements: ['style', 'script']
        };
    }

    global.parseWithTurndown = function parseWithTurndown() {
        if (!global.document) {
            throw new Error('Document is not available.');
        }

        var target = global.document.documentElement;
        var config = getDefaultConfig();
        var service = getDefaultService();
        var preparedTarget = prepareTarget(target, config);

        if (typeof preparedTarget === 'string' || isNode(preparedTarget)) {
            return service.turndown(preparedTarget);
        }

        throw new TypeError('Failed to prepare target for parsing.');
    };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
