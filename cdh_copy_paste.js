function isCDH() {
    var u = document.URL.toLowerCase();
    if (u.indexOf('.tealiumiq.com/datacloud') > 0) return true;
    else if (u.indexOf('.tealiumiq.com/tms') > 0 && u.indexOf('product=ss') > 0) return true;
    else return false;
}
if (isCDH()) {
    if (!window.cdh_copy_paste) {
        //#region Q Lib
        // vim:ts=4:sts=4:sw=4:
        /*!
         *
         * Copyright 2009-2017 Kris Kowal under the terms of the MIT
         * license found at https://github.com/kriskowal/q/blob/v1/LICENSE
         *
         * With parts by Tyler Close
         * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
         * at http://www.opensource.org/licenses/mit-license.html
         * Forked at ref_send.js version: 2009-05-11
         *
         * With parts by Mark Miller
         * Copyright (C) 2011 Google Inc.
         *
         * Licensed under the Apache License, Version 2.0 (the "License");
         * you may not use this file except in compliance with the License.
         * You may obtain a copy of the License at
         *
         * http://www.apache.org/licenses/LICENSE-2.0
         *
         * Unless required by applicable law or agreed to in writing, software
         * distributed under the License is distributed on an "AS IS" BASIS,
         * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
         * See the License for the specific language governing permissions and
         * limitations under the License.
         *
         */

        (function (definition) {
            "use strict";

            // This file will function properly as a <script> tag, or a module
            // using CommonJS and NodeJS or RequireJS module formats.  In
            // Common/Node/RequireJS, the module exports the Q API and when
            // executed as a simple <script>, it creates a Q global instead.

            // Montage Require
            if (typeof bootstrap === "function") {
                bootstrap("promise", definition);

                // CommonJS
            } else if (
                typeof exports === "object" &&
                typeof module === "object"
            ) {
                module.exports = definition();

                // RequireJS
            } else if (typeof define === "function" && define.amd) {
                define(definition);

                // SES (Secure EcmaScript)
            } else if (typeof ses !== "undefined") {
                if (!ses.ok()) {
                    return;
                } else {
                    ses.makeQ = definition;
                }

                // <script>
            } else if (
                typeof window !== "undefined" ||
                typeof self !== "undefined"
            ) {
                // Prefer window over self for add-on scripts. Use self for
                // non-windowed contexts.
                var global = typeof window !== "undefined" ? window : self;

                // Get the `window` object, save the previous Q global
                // and initialize Q as a global.
                var previousQ = global.Q;
                global.Q = definition();

                // Add a noConflict function so Q can be removed from the
                // global namespace.
                global.Q.noConflict = function () {
                    global.Q = previousQ;
                    return this;
                };
            } else {
                throw new Error(
                    "This environment was not anticipated by Q. Please file a bug."
                );
            }
        })(function () {
            "use strict";

            var hasStacks = false;
            try {
                throw new Error();
            } catch (e) {
                hasStacks = !!e.stack;
            }

            // All code after this point will be filtered from stack traces reported
            // by Q.
            var qStartingLine = captureLine();
            var qFileName;

            // shims

            // used for fallback in "allResolved"
            var noop = function () {};

            // Use the fastest possible means to execute a task in a future turn
            // of the event loop.
            var nextTick = (function () {
                // linked list of tasks (single, with head node)
                var head = { task: void 0, next: null };
                var tail = head;
                var flushing = false;
                var requestTick = void 0;
                var isNodeJS = false;
                // queue for late tasks, used by unhandled rejection tracking
                var laterQueue = [];

                function flush() {
                    /* jshint loopfunc: true */
                    var task, domain;

                    while (head.next) {
                        head = head.next;
                        task = head.task;
                        head.task = void 0;
                        domain = head.domain;

                        if (domain) {
                            head.domain = void 0;
                            domain.enter();
                        }
                        runSingle(task, domain);
                    }
                    while (laterQueue.length) {
                        task = laterQueue.pop();
                        runSingle(task);
                    }
                    flushing = false;
                }
                // runs a single function in the async queue
                function runSingle(task, domain) {
                    try {
                        task();
                    } catch (e) {
                        if (isNodeJS) {
                            // In node, uncaught exceptions are considered fatal errors.
                            // Re-throw them synchronously to interrupt flushing!

                            // Ensure continuation if the uncaught exception is suppressed
                            // listening "uncaughtException" events (as domains does).
                            // Continue in next event to avoid tick recursion.
                            if (domain) {
                                domain.exit();
                            }
                            setTimeout(flush, 0);
                            if (domain) {
                                domain.enter();
                            }

                            throw e;
                        } else {
                            // In browsers, uncaught exceptions are not fatal.
                            // Re-throw them asynchronously to avoid slow-downs.
                            setTimeout(function () {
                                throw e;
                            }, 0);
                        }
                    }

                    if (domain) {
                        domain.exit();
                    }
                }

                nextTick = function (task) {
                    tail = tail.next = {
                        task: task,
                        domain: isNodeJS && process.domain,
                        next: null,
                    };

                    if (!flushing) {
                        flushing = true;
                        requestTick();
                    }
                };

                if (
                    typeof process === "object" &&
                    process.toString() === "[object process]" &&
                    process.nextTick
                ) {
                    // Ensure Q is in a real Node environment, with a `process.nextTick`.
                    // To see through fake Node environments:
                    // * Mocha test runner - exposes a `process` global without a `nextTick`
                    // * Browserify - exposes a `process.nexTick` function that uses
                    //   `setTimeout`. In this case `setImmediate` is preferred because
                    //    it is faster. Browserify's `process.toString()` yields
                    //   "[object Object]", while in a real Node environment
                    //   `process.toString()` yields "[object process]".
                    isNodeJS = true;

                    requestTick = function () {
                        process.nextTick(flush);
                    };
                } else if (typeof setImmediate === "function") {
                    // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
                    if (typeof window !== "undefined") {
                        requestTick = setImmediate.bind(window, flush);
                    } else {
                        requestTick = function () {
                            setImmediate(flush);
                        };
                    }
                } else if (typeof MessageChannel !== "undefined") {
                    // modern browsers
                    // http://www.nonblocking.io/2011/06/windownexttick.html
                    var channel = new MessageChannel();
                    // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
                    // working message ports the first time a page loads.
                    channel.port1.onmessage = function () {
                        requestTick = requestPortTick;
                        channel.port1.onmessage = flush;
                        flush();
                    };
                    var requestPortTick = function () {
                        // Opera requires us to provide a message payload, regardless of
                        // whether we use it.
                        channel.port2.postMessage(0);
                    };
                    requestTick = function () {
                        setTimeout(flush, 0);
                        requestPortTick();
                    };
                } else {
                    // old browsers
                    requestTick = function () {
                        setTimeout(flush, 0);
                    };
                }
                // runs a task after all other tasks have been run
                // this is useful for unhandled rejection tracking that needs to happen
                // after all `then`d tasks have been run.
                nextTick.runAfter = function (task) {
                    laterQueue.push(task);
                    if (!flushing) {
                        flushing = true;
                        requestTick();
                    }
                };
                return nextTick;
            })();

            // Attempt to make generics safe in the face of downstream
            // modifications.
            // There is no situation where this is necessary.
            // If you need a security guarantee, these primordials need to be
            // deeply frozen anyway, and if you don't need a security guarantee,
            // this is just plain paranoid.
            // However, this **might** have the nice side-effect of reducing the size of
            // the minified code by reducing x.call() to merely x()
            // See Mark Miller's explanation of what this does.
            // http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
            var call = Function.call;
            function uncurryThis(f) {
                return function () {
                    return call.apply(f, arguments);
                };
            }
            // This is equivalent, but slower:
            // uncurryThis = Function_bind.bind(Function_bind.call);
            // http://jsperf.com/uncurrythis

            var array_slice = uncurryThis(Array.prototype.slice);

            var array_reduce = uncurryThis(
                Array.prototype.reduce ||
                    function (callback, basis) {
                        var index = 0,
                            length = this.length;
                        // concerning the initial value, if one is not provided
                        if (arguments.length === 1) {
                            // seek to the first value in the array, accounting
                            // for the possibility that is is a sparse array
                            do {
                                if (index in this) {
                                    basis = this[index++];
                                    break;
                                }
                                if (++index >= length) {
                                    throw new TypeError();
                                }
                            } while (1);
                        }
                        // reduce
                        for (; index < length; index++) {
                            // account for the possibility that the array is sparse
                            if (index in this) {
                                basis = callback(basis, this[index], index);
                            }
                        }
                        return basis;
                    }
            );

            var array_indexOf = uncurryThis(
                Array.prototype.indexOf ||
                    function (value) {
                        // not a very good shim, but good enough for our one use of it
                        for (var i = 0; i < this.length; i++) {
                            if (this[i] === value) {
                                return i;
                            }
                        }
                        return -1;
                    }
            );

            var array_map = uncurryThis(
                Array.prototype.map ||
                    function (callback, thisp) {
                        var self = this;
                        var collect = [];
                        array_reduce(
                            self,
                            function (undefined, value, index) {
                                collect.push(
                                    callback.call(thisp, value, index, self)
                                );
                            },
                            void 0
                        );
                        return collect;
                    }
            );

            var object_create =
                Object.create ||
                function (prototype) {
                    function Type() {}
                    Type.prototype = prototype;
                    return new Type();
                };

            var object_defineProperty =
                Object.defineProperty ||
                function (obj, prop, descriptor) {
                    obj[prop] = descriptor.value;
                    return obj;
                };

            var object_hasOwnProperty = uncurryThis(
                Object.prototype.hasOwnProperty
            );

            var object_keys =
                Object.keys ||
                function (object) {
                    var keys = [];
                    for (var key in object) {
                        if (object_hasOwnProperty(object, key)) {
                            keys.push(key);
                        }
                    }
                    return keys;
                };

            var object_toString = uncurryThis(Object.prototype.toString);

            function isObject(value) {
                return value === Object(value);
            }

            // generator related shims

            // FIXME: Remove this function once ES6 generators are in SpiderMonkey.
            function isStopIteration(exception) {
                return (
                    object_toString(exception) === "[object StopIteration]" ||
                    exception instanceof QReturnValue
                );
            }

            // FIXME: Remove this helper and Q.return once ES6 generators are in
            // SpiderMonkey.
            var QReturnValue;
            if (typeof ReturnValue !== "undefined") {
                QReturnValue = ReturnValue;
            } else {
                QReturnValue = function (value) {
                    this.value = value;
                };
            }

            // long stack traces

            var STACK_JUMP_SEPARATOR = "From previous event:";

            function makeStackTraceLong(error, promise) {
                // If possible, transform the error stack trace by removing Node and Q
                // cruft, then concatenating with the stack trace of `promise`. See #57.
                if (
                    hasStacks &&
                    promise.stack &&
                    typeof error === "object" &&
                    error !== null &&
                    error.stack
                ) {
                    var stacks = [];
                    for (var p = promise; !!p; p = p.source) {
                        if (
                            p.stack &&
                            (!error.__minimumStackCounter__ ||
                                error.__minimumStackCounter__ > p.stackCounter)
                        ) {
                            object_defineProperty(
                                error,
                                "__minimumStackCounter__",
                                { value: p.stackCounter, configurable: true }
                            );
                            stacks.unshift(p.stack);
                        }
                    }
                    stacks.unshift(error.stack);

                    var concatedStacks = stacks.join(
                        "\n" + STACK_JUMP_SEPARATOR + "\n"
                    );
                    var stack = filterStackString(concatedStacks);
                    object_defineProperty(error, "stack", {
                        value: stack,
                        configurable: true,
                    });
                }
            }

            function filterStackString(stackString) {
                var lines = stackString.split("\n");
                var desiredLines = [];
                for (var i = 0; i < lines.length; ++i) {
                    var line = lines[i];

                    if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
                        desiredLines.push(line);
                    }
                }
                return desiredLines.join("\n");
            }

            function isNodeFrame(stackLine) {
                return (
                    stackLine.indexOf("(module.js:") !== -1 ||
                    stackLine.indexOf("(node.js:") !== -1
                );
            }

            function getFileNameAndLineNumber(stackLine) {
                // Named functions: "at functionName (filename:lineNumber:columnNumber)"
                // In IE10 function name can have spaces ("Anonymous function") O_o
                var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
                if (attempt1) {
                    return [attempt1[1], Number(attempt1[2])];
                }

                // Anonymous functions: "at filename:lineNumber:columnNumber"
                var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
                if (attempt2) {
                    return [attempt2[1], Number(attempt2[2])];
                }

                // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
                var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
                if (attempt3) {
                    return [attempt3[1], Number(attempt3[2])];
                }
            }

            function isInternalFrame(stackLine) {
                var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

                if (!fileNameAndLineNumber) {
                    return false;
                }

                var fileName = fileNameAndLineNumber[0];
                var lineNumber = fileNameAndLineNumber[1];

                return (
                    fileName === qFileName &&
                    lineNumber >= qStartingLine &&
                    lineNumber <= qEndingLine
                );
            }

            // discover own file name and line number range for filtering stack
            // traces
            function captureLine() {
                if (!hasStacks) {
                    return;
                }

                try {
                    throw new Error();
                } catch (e) {
                    var lines = e.stack.split("\n");
                    var firstLine =
                        lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
                    var fileNameAndLineNumber =
                        getFileNameAndLineNumber(firstLine);
                    if (!fileNameAndLineNumber) {
                        return;
                    }

                    qFileName = fileNameAndLineNumber[0];
                    return fileNameAndLineNumber[1];
                }
            }

            function deprecate(callback, name, alternative) {
                return function () {
                    if (
                        typeof console !== "undefined" &&
                        typeof console.warn === "function"
                    ) {
                        console.warn(
                            name +
                                " is deprecated, use " +
                                alternative +
                                " instead.",
                            new Error("").stack
                        );
                    }
                    return callback.apply(callback, arguments);
                };
            }

            // end of shims
            // beginning of real work

            /**
             * Constructs a promise for an immediate reference, passes promises through, or
             * coerces promises from different systems.
             * @param value immediate reference or promise
             */
            function Q(value) {
                // If the object is already a Promise, return it directly.  This enables
                // the resolve function to both be used to created references from objects,
                // but to tolerably coerce non-promises to promises.
                if (value instanceof Promise) {
                    return value;
                }

                // assimilate thenables
                if (isPromiseAlike(value)) {
                    return coerce(value);
                } else {
                    return fulfill(value);
                }
            }
            Q.resolve = Q;

            /**
             * Performs a task in a future turn of the event loop.
             * @param {Function} task
             */
            Q.nextTick = nextTick;

            /**
             * Controls whether or not long stack traces will be on
             */
            Q.longStackSupport = false;

            /**
             * The counter is used to determine the stopping point for building
             * long stack traces. In makeStackTraceLong we walk backwards through
             * the linked list of promises, only stacks which were created before
             * the rejection are concatenated.
             */
            var longStackCounter = 1;

            // enable long stacks if Q_DEBUG is set
            if (
                typeof process === "object" &&
                process &&
                process.env &&
                process.env.Q_DEBUG
            ) {
                Q.longStackSupport = true;
            }

            /**
             * Constructs a {promise, resolve, reject} object.
             *
             * `resolve` is a callback to invoke with a more resolved value for the
             * promise. To fulfill the promise, invoke `resolve` with any value that is
             * not a thenable. To reject the promise, invoke `resolve` with a rejected
             * thenable, or invoke `reject` with the reason directly. To resolve the
             * promise to another thenable, thus putting it in the same state, invoke
             * `resolve` with that other thenable.
             */
            Q.defer = defer;
            function defer() {
                // if "messages" is an "Array", that indicates that the promise has not yet
                // been resolved.  If it is "undefined", it has been resolved.  Each
                // element of the messages array is itself an array of complete arguments to
                // forward to the resolved promise.  We coerce the resolution value to a
                // promise using the `resolve` function because it handles both fully
                // non-thenable values and other thenables gracefully.
                var messages = [],
                    progressListeners = [],
                    resolvedPromise;

                var deferred = object_create(defer.prototype);
                var promise = object_create(Promise.prototype);

                promise.promiseDispatch = function (resolve, op, operands) {
                    var args = array_slice(arguments);
                    if (messages) {
                        messages.push(args);
                        if (op === "when" && operands[1]) {
                            // progress operand
                            progressListeners.push(operands[1]);
                        }
                    } else {
                        Q.nextTick(function () {
                            resolvedPromise.promiseDispatch.apply(
                                resolvedPromise,
                                args
                            );
                        });
                    }
                };

                // XXX deprecated
                promise.valueOf = function () {
                    if (messages) {
                        return promise;
                    }
                    var nearerValue = nearer(resolvedPromise);
                    if (isPromise(nearerValue)) {
                        resolvedPromise = nearerValue; // shorten chain
                    }
                    return nearerValue;
                };

                promise.inspect = function () {
                    if (!resolvedPromise) {
                        return { state: "pending" };
                    }
                    return resolvedPromise.inspect();
                };

                if (Q.longStackSupport && hasStacks) {
                    try {
                        throw new Error();
                    } catch (e) {
                        // NOTE: don't try to use `Error.captureStackTrace` or transfer the
                        // accessor around; that causes memory leaks as per GH-111. Just
                        // reify the stack trace as a string ASAP.
                        //
                        // At the same time, cut off the first line; it's always just
                        // "[object Promise]\n", as per the `toString`.
                        promise.stack = e.stack.substring(
                            e.stack.indexOf("\n") + 1
                        );
                        promise.stackCounter = longStackCounter++;
                    }
                }

                // NOTE: we do the checks for `resolvedPromise` in each method, instead of
                // consolidating them into `become`, since otherwise we'd create new
                // promises with the lines `become(whatever(value))`. See e.g. GH-252.

                function become(newPromise) {
                    resolvedPromise = newPromise;

                    if (Q.longStackSupport && hasStacks) {
                        // Only hold a reference to the new promise if long stacks
                        // are enabled to reduce memory usage
                        promise.source = newPromise;
                    }

                    array_reduce(
                        messages,
                        function (undefined, message) {
                            Q.nextTick(function () {
                                newPromise.promiseDispatch.apply(
                                    newPromise,
                                    message
                                );
                            });
                        },
                        void 0
                    );

                    messages = void 0;
                    progressListeners = void 0;
                }

                deferred.promise = promise;
                deferred.resolve = function (value) {
                    if (resolvedPromise) {
                        return;
                    }

                    become(Q(value));
                };

                deferred.fulfill = function (value) {
                    if (resolvedPromise) {
                        return;
                    }

                    become(fulfill(value));
                };
                deferred.reject = function (reason) {
                    if (resolvedPromise) {
                        return;
                    }

                    become(reject(reason));
                };
                deferred.notify = function (progress) {
                    if (resolvedPromise) {
                        return;
                    }

                    array_reduce(
                        progressListeners,
                        function (undefined, progressListener) {
                            Q.nextTick(function () {
                                progressListener(progress);
                            });
                        },
                        void 0
                    );
                };

                return deferred;
            }

            /**
             * Creates a Node-style callback that will resolve or reject the deferred
             * promise.
             * @returns a nodeback
             */
            defer.prototype.makeNodeResolver = function () {
                var self = this;
                return function (error, value) {
                    if (error) {
                        self.reject(error);
                    } else if (arguments.length > 2) {
                        self.resolve(array_slice(arguments, 1));
                    } else {
                        self.resolve(value);
                    }
                };
            };

            /**
             * @param resolver {Function} a function that returns nothing and accepts
             * the resolve, reject, and notify functions for a deferred.
             * @returns a promise that may be resolved with the given resolve and reject
             * functions, or rejected by a thrown exception in resolver
             */
            Q.Promise = promise; // ES6
            Q.promise = promise;
            function promise(resolver) {
                if (typeof resolver !== "function") {
                    throw new TypeError("resolver must be a function.");
                }
                var deferred = defer();
                try {
                    resolver(
                        deferred.resolve,
                        deferred.reject,
                        deferred.notify
                    );
                } catch (reason) {
                    deferred.reject(reason);
                }
                return deferred.promise;
            }

            promise.race = race; // ES6
            promise.all = all; // ES6
            promise.reject = reject; // ES6
            promise.resolve = Q; // ES6

            // XXX experimental.  This method is a way to denote that a local value is
            // serializable and should be immediately dispatched to a remote upon request,
            // instead of passing a reference.
            Q.passByCopy = function (object) {
                //freeze(object);
                //passByCopies.set(object, true);
                return object;
            };

            Promise.prototype.passByCopy = function () {
                //freeze(object);
                //passByCopies.set(object, true);
                return this;
            };

            /**
             * If two promises eventually fulfill to the same value, promises that value,
             * but otherwise rejects.
             * @param x {Any*}
             * @param y {Any*}
             * @returns {Any*} a promise for x and y if they are the same, but a rejection
             * otherwise.
             *
             */
            Q.join = function (x, y) {
                return Q(x).join(y);
            };

            Promise.prototype.join = function (that) {
                return Q([this, that]).spread(function (x, y) {
                    if (x === y) {
                        // TODO: "===" should be Object.is or equiv
                        return x;
                    } else {
                        throw new Error(
                            "Q can't join: not the same: " + x + " " + y
                        );
                    }
                });
            };

            /**
             * Returns a promise for the first of an array of promises to become settled.
             * @param answers {Array[Any*]} promises to race
             * @returns {Any*} the first promise to be settled
             */
            Q.race = race;
            function race(answerPs) {
                return promise(function (resolve, reject) {
                    // Switch to this once we can assume at least ES5
                    // answerPs.forEach(function (answerP) {
                    //     Q(answerP).then(resolve, reject);
                    // });
                    // Use this in the meantime
                    for (var i = 0, len = answerPs.length; i < len; i++) {
                        Q(answerPs[i]).then(resolve, reject);
                    }
                });
            }

            Promise.prototype.race = function () {
                return this.then(Q.race);
            };

            /**
             * Constructs a Promise with a promise descriptor object and optional fallback
             * function.  The descriptor contains methods like when(rejected), get(name),
             * set(name, value), post(name, args), and delete(name), which all
             * return either a value, a promise for a value, or a rejection.  The fallback
             * accepts the operation name, a resolver, and any further arguments that would
             * have been forwarded to the appropriate method above had a method been
             * provided with the proper name.  The API makes no guarantees about the nature
             * of the returned object, apart from that it is usable wherever promises are
             * bought and sold.
             */
            Q.makePromise = Promise;
            function Promise(descriptor, fallback, inspect) {
                if (fallback === void 0) {
                    fallback = function (op) {
                        return reject(
                            new Error(
                                "Promise does not support operation: " + op
                            )
                        );
                    };
                }
                if (inspect === void 0) {
                    inspect = function () {
                        return { state: "unknown" };
                    };
                }

                var promise = object_create(Promise.prototype);

                promise.promiseDispatch = function (resolve, op, args) {
                    var result;
                    try {
                        if (descriptor[op]) {
                            result = descriptor[op].apply(promise, args);
                        } else {
                            result = fallback.call(promise, op, args);
                        }
                    } catch (exception) {
                        result = reject(exception);
                    }
                    if (resolve) {
                        resolve(result);
                    }
                };

                promise.inspect = inspect;

                // XXX deprecated `valueOf` and `exception` support
                if (inspect) {
                    var inspected = inspect();
                    if (inspected.state === "rejected") {
                        promise.exception = inspected.reason;
                    }

                    promise.valueOf = function () {
                        var inspected = inspect();
                        if (
                            inspected.state === "pending" ||
                            inspected.state === "rejected"
                        ) {
                            return promise;
                        }
                        return inspected.value;
                    };
                }

                return promise;
            }

            Promise.prototype.toString = function () {
                return "[object Promise]";
            };

            Promise.prototype.then = function (
                fulfilled,
                rejected,
                progressed
            ) {
                var self = this;
                var deferred = defer();
                var done = false; // ensure the untrusted promise makes at most a
                // single call to one of the callbacks

                function _fulfilled(value) {
                    try {
                        return typeof fulfilled === "function"
                            ? fulfilled(value)
                            : value;
                    } catch (exception) {
                        return reject(exception);
                    }
                }

                function _rejected(exception) {
                    if (typeof rejected === "function") {
                        makeStackTraceLong(exception, self);
                        try {
                            return rejected(exception);
                        } catch (newException) {
                            return reject(newException);
                        }
                    }
                    return reject(exception);
                }

                function _progressed(value) {
                    return typeof progressed === "function"
                        ? progressed(value)
                        : value;
                }

                Q.nextTick(function () {
                    self.promiseDispatch(
                        function (value) {
                            if (done) {
                                return;
                            }
                            done = true;

                            deferred.resolve(_fulfilled(value));
                        },
                        "when",
                        [
                            function (exception) {
                                if (done) {
                                    return;
                                }
                                done = true;

                                deferred.resolve(_rejected(exception));
                            },
                        ]
                    );
                });

                // Progress propagator need to be attached in the current tick.
                self.promiseDispatch(void 0, "when", [
                    void 0,
                    function (value) {
                        var newValue;
                        var threw = false;
                        try {
                            newValue = _progressed(value);
                        } catch (e) {
                            threw = true;
                            if (Q.onerror) {
                                Q.onerror(e);
                            } else {
                                throw e;
                            }
                        }

                        if (!threw) {
                            deferred.notify(newValue);
                        }
                    },
                ]);

                return deferred.promise;
            };

            Q.tap = function (promise, callback) {
                return Q(promise).tap(callback);
            };

            /**
             * Works almost like "finally", but not called for rejections.
             * Original resolution value is passed through callback unaffected.
             * Callback may return a promise that will be awaited for.
             * @param {Function} callback
             * @returns {Q.Promise}
             * @example
             * doSomething()
             *   .then(...)
             *   .tap(console.log)
             *   .then(...);
             */
            Promise.prototype.tap = function (callback) {
                callback = Q(callback);

                return this.then(function (value) {
                    return callback.fcall(value).thenResolve(value);
                });
            };

            /**
             * Registers an observer on a promise.
             *
             * Guarantees:
             *
             * 1. that fulfilled and rejected will be called only once.
             * 2. that either the fulfilled callback or the rejected callback will be
             *    called, but not both.
             * 3. that fulfilled and rejected will not be called in this turn.
             *
             * @param value      promise or immediate reference to observe
             * @param fulfilled  function to be called with the fulfilled value
             * @param rejected   function to be called with the rejection exception
             * @param progressed function to be called on any progress notifications
             * @return promise for the return value from the invoked callback
             */
            Q.when = when;
            function when(value, fulfilled, rejected, progressed) {
                return Q(value).then(fulfilled, rejected, progressed);
            }

            Promise.prototype.thenResolve = function (value) {
                return this.then(function () {
                    return value;
                });
            };

            Q.thenResolve = function (promise, value) {
                return Q(promise).thenResolve(value);
            };

            Promise.prototype.thenReject = function (reason) {
                return this.then(function () {
                    throw reason;
                });
            };

            Q.thenReject = function (promise, reason) {
                return Q(promise).thenReject(reason);
            };

            /**
             * If an object is not a promise, it is as "near" as possible.
             * If a promise is rejected, it is as "near" as possible too.
             * If it's a fulfilled promise, the fulfillment value is nearer.
             * If it's a deferred promise and the deferred has been resolved, the
             * resolution is "nearer".
             * @param object
             * @returns most resolved (nearest) form of the object
             */

            // XXX should we re-do this?
            Q.nearer = nearer;
            function nearer(value) {
                if (isPromise(value)) {
                    var inspected = value.inspect();
                    if (inspected.state === "fulfilled") {
                        return inspected.value;
                    }
                }
                return value;
            }

            /**
             * @returns whether the given object is a promise.
             * Otherwise it is a fulfilled value.
             */
            Q.isPromise = isPromise;
            function isPromise(object) {
                return object instanceof Promise;
            }

            Q.isPromiseAlike = isPromiseAlike;
            function isPromiseAlike(object) {
                return isObject(object) && typeof object.then === "function";
            }

            /**
             * @returns whether the given object is a pending promise, meaning not
             * fulfilled or rejected.
             */
            Q.isPending = isPending;
            function isPending(object) {
                return (
                    isPromise(object) && object.inspect().state === "pending"
                );
            }

            Promise.prototype.isPending = function () {
                return this.inspect().state === "pending";
            };

            /**
             * @returns whether the given object is a value or fulfilled
             * promise.
             */
            Q.isFulfilled = isFulfilled;
            function isFulfilled(object) {
                return (
                    !isPromise(object) || object.inspect().state === "fulfilled"
                );
            }

            Promise.prototype.isFulfilled = function () {
                return this.inspect().state === "fulfilled";
            };

            /**
             * @returns whether the given object is a rejected promise.
             */
            Q.isRejected = isRejected;
            function isRejected(object) {
                return (
                    isPromise(object) && object.inspect().state === "rejected"
                );
            }

            Promise.prototype.isRejected = function () {
                return this.inspect().state === "rejected";
            };

            //// BEGIN UNHANDLED REJECTION TRACKING

            // This promise library consumes exceptions thrown in handlers so they can be
            // handled by a subsequent promise.  The exceptions get added to this array when
            // they are created, and removed when they are handled.  Note that in ES6 or
            // shimmed environments, this would naturally be a `Set`.
            var unhandledReasons = [];
            var unhandledRejections = [];
            var reportedUnhandledRejections = [];
            var trackUnhandledRejections = true;

            function resetUnhandledRejections() {
                unhandledReasons.length = 0;
                unhandledRejections.length = 0;

                if (!trackUnhandledRejections) {
                    trackUnhandledRejections = true;
                }
            }

            function trackRejection(promise, reason) {
                if (!trackUnhandledRejections) {
                    return;
                }
                if (
                    typeof process === "object" &&
                    typeof process.emit === "function"
                ) {
                    Q.nextTick.runAfter(function () {
                        if (
                            array_indexOf(unhandledRejections, promise) !== -1
                        ) {
                            process.emit("unhandledRejection", reason, promise);
                            reportedUnhandledRejections.push(promise);
                        }
                    });
                }

                unhandledRejections.push(promise);
                if (reason && typeof reason.stack !== "undefined") {
                    unhandledReasons.push(reason.stack);
                } else {
                    unhandledReasons.push("(no stack) " + reason);
                }
            }

            function untrackRejection(promise) {
                if (!trackUnhandledRejections) {
                    return;
                }

                var at = array_indexOf(unhandledRejections, promise);
                if (at !== -1) {
                    if (
                        typeof process === "object" &&
                        typeof process.emit === "function"
                    ) {
                        Q.nextTick.runAfter(function () {
                            var atReport = array_indexOf(
                                reportedUnhandledRejections,
                                promise
                            );
                            if (atReport !== -1) {
                                process.emit(
                                    "rejectionHandled",
                                    unhandledReasons[at],
                                    promise
                                );
                                reportedUnhandledRejections.splice(atReport, 1);
                            }
                        });
                    }
                    unhandledRejections.splice(at, 1);
                    unhandledReasons.splice(at, 1);
                }
            }

            Q.resetUnhandledRejections = resetUnhandledRejections;

            Q.getUnhandledReasons = function () {
                // Make a copy so that consumers can't interfere with our internal state.
                return unhandledReasons.slice();
            };

            Q.stopUnhandledRejectionTracking = function () {
                resetUnhandledRejections();
                trackUnhandledRejections = false;
            };

            resetUnhandledRejections();

            //// END UNHANDLED REJECTION TRACKING

            /**
             * Constructs a rejected promise.
             * @param reason value describing the failure
             */
            Q.reject = reject;
            function reject(reason) {
                var rejection = Promise(
                    {
                        when: function (rejected) {
                            // note that the error has been handled
                            if (rejected) {
                                untrackRejection(this);
                            }
                            return rejected ? rejected(reason) : this;
                        },
                    },
                    function fallback() {
                        return this;
                    },
                    function inspect() {
                        return { state: "rejected", reason: reason };
                    }
                );

                // Note that the reason has not been handled.
                trackRejection(rejection, reason);

                return rejection;
            }

            /**
             * Constructs a fulfilled promise for an immediate reference.
             * @param value immediate reference
             */
            Q.fulfill = fulfill;
            function fulfill(value) {
                return Promise(
                    {
                        when: function () {
                            return value;
                        },
                        get: function (name) {
                            return value[name];
                        },
                        set: function (name, rhs) {
                            value[name] = rhs;
                        },
                        delete: function (name) {
                            delete value[name];
                        },
                        post: function (name, args) {
                            // Mark Miller proposes that post with no name should apply a
                            // promised function.
                            if (name === null || name === void 0) {
                                return value.apply(void 0, args);
                            } else {
                                return value[name].apply(value, args);
                            }
                        },
                        apply: function (thisp, args) {
                            return value.apply(thisp, args);
                        },
                        keys: function () {
                            return object_keys(value);
                        },
                    },
                    void 0,
                    function inspect() {
                        return { state: "fulfilled", value: value };
                    }
                );
            }

            /**
             * Converts thenables to Q promises.
             * @param promise thenable promise
             * @returns a Q promise
             */
            function coerce(promise) {
                var deferred = defer();
                Q.nextTick(function () {
                    try {
                        promise.then(
                            deferred.resolve,
                            deferred.reject,
                            deferred.notify
                        );
                    } catch (exception) {
                        deferred.reject(exception);
                    }
                });
                return deferred.promise;
            }

            /**
             * Annotates an object such that it will never be
             * transferred away from this process over any promise
             * communication channel.
             * @param object
             * @returns promise a wrapping of that object that
             * additionally responds to the "isDef" message
             * without a rejection.
             */
            Q.master = master;
            function master(object) {
                return Promise(
                    {
                        isDef: function () {},
                    },
                    function fallback(op, args) {
                        return dispatch(object, op, args);
                    },
                    function () {
                        return Q(object).inspect();
                    }
                );
            }

            /**
             * Spreads the values of a promised array of arguments into the
             * fulfillment callback.
             * @param fulfilled callback that receives variadic arguments from the
             * promised array
             * @param rejected callback that receives the exception if the promise
             * is rejected.
             * @returns a promise for the return value or thrown exception of
             * either callback.
             */
            Q.spread = spread;
            function spread(value, fulfilled, rejected) {
                return Q(value).spread(fulfilled, rejected);
            }

            Promise.prototype.spread = function (fulfilled, rejected) {
                return this.all().then(function (array) {
                    return fulfilled.apply(void 0, array);
                }, rejected);
            };

            /**
             * The async function is a decorator for generator functions, turning
             * them into asynchronous generators.  Although generators are only part
             * of the newest ECMAScript 6 drafts, this code does not cause syntax
             * errors in older engines.  This code should continue to work and will
             * in fact improve over time as the language improves.
             *
             * ES6 generators are currently part of V8 version 3.19 with the
             * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
             * for longer, but under an older Python-inspired form.  This function
             * works on both kinds of generators.
             *
             * Decorates a generator function such that:
             *  - it may yield promises
             *  - execution will continue when that promise is fulfilled
             *  - the value of the yield expression will be the fulfilled value
             *  - it returns a promise for the return value (when the generator
             *    stops iterating)
             *  - the decorated function returns a promise for the return value
             *    of the generator or the first rejected promise among those
             *    yielded.
             *  - if an error is thrown in the generator, it propagates through
             *    every following yield until it is caught, or until it escapes
             *    the generator function altogether, and is translated into a
             *    rejection for the promise returned by the decorated generator.
             */
            Q.async = async;
            function async(makeGenerator) {
                return function () {
                    // when verb is "send", arg is a value
                    // when verb is "throw", arg is an exception
                    function continuer(verb, arg) {
                        var result;

                        // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
                        // engine that has a deployed base of browsers that support generators.
                        // However, SM's generators use the Python-inspired semantics of
                        // outdated ES6 drafts.  We would like to support ES6, but we'd also
                        // like to make it possible to use generators in deployed browsers, so
                        // we also support Python-style generators.  At some point we can remove
                        // this block.

                        if (typeof StopIteration === "undefined") {
                            // ES6 Generators
                            try {
                                result = generator[verb](arg);
                            } catch (exception) {
                                return reject(exception);
                            }
                            if (result.done) {
                                return Q(result.value);
                            } else {
                                return when(result.value, callback, errback);
                            }
                        } else {
                            // SpiderMonkey Generators
                            // FIXME: Remove this case when SM does ES6 generators.
                            try {
                                result = generator[verb](arg);
                            } catch (exception) {
                                if (isStopIteration(exception)) {
                                    return Q(exception.value);
                                } else {
                                    return reject(exception);
                                }
                            }
                            return when(result, callback, errback);
                        }
                    }
                    var generator = makeGenerator.apply(this, arguments);
                    var callback = continuer.bind(continuer, "next");
                    var errback = continuer.bind(continuer, "throw");
                    return callback();
                };
            }

            /**
             * The spawn function is a small wrapper around async that immediately
             * calls the generator and also ends the promise chain, so that any
             * unhandled errors are thrown instead of forwarded to the error
             * handler. This is useful because it's extremely common to run
             * generators at the top-level to work with libraries.
             */
            Q.spawn = spawn;
            function spawn(makeGenerator) {
                Q.done(Q.async(makeGenerator)());
            }

            // FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
            /**
             * Throws a ReturnValue exception to stop an asynchronous generator.
             *
             * This interface is a stop-gap measure to support generator return
             * values in older Firefox/SpiderMonkey.  In browsers that support ES6
             * generators like Chromium 29, just use "return" in your generator
             * functions.
             *
             * @param value the return value for the surrounding generator
             * @throws ReturnValue exception with the value.
             * @example
             * // ES6 style
             * Q.async(function* () {
             *      var foo = yield getFooPromise();
             *      var bar = yield getBarPromise();
             *      return foo + bar;
             * })
             * // Older SpiderMonkey style
             * Q.async(function () {
             *      var foo = yield getFooPromise();
             *      var bar = yield getBarPromise();
             *      Q.return(foo + bar);
             * })
             */
            Q["return"] = _return;
            function _return(value) {
                throw new QReturnValue(value);
            }

            /**
             * The promised function decorator ensures that any promise arguments
             * are settled and passed as values (`this` is also settled and passed
             * as a value).  It will also ensure that the result of a function is
             * always a promise.
             *
             * @example
             * var add = Q.promised(function (a, b) {
             *     return a + b;
             * });
             * add(Q(a), Q(B));
             *
             * @param {function} callback The function to decorate
             * @returns {function} a function that has been decorated.
             */
            Q.promised = promised;
            function promised(callback) {
                return function () {
                    return spread(
                        [this, all(arguments)],
                        function (self, args) {
                            return callback.apply(self, args);
                        }
                    );
                };
            }

            /**
             * sends a message to a value in a future turn
             * @param object* the recipient
             * @param op the name of the message operation, e.g., "when",
             * @param args further arguments to be forwarded to the operation
             * @returns result {Promise} a promise for the result of the operation
             */
            Q.dispatch = dispatch;
            function dispatch(object, op, args) {
                return Q(object).dispatch(op, args);
            }

            Promise.prototype.dispatch = function (op, args) {
                var self = this;
                var deferred = defer();
                Q.nextTick(function () {
                    self.promiseDispatch(deferred.resolve, op, args);
                });
                return deferred.promise;
            };

            /**
             * Gets the value of a property in a future turn.
             * @param object    promise or immediate reference for target object
             * @param name      name of property to get
             * @return promise for the property value
             */
            Q.get = function (object, key) {
                return Q(object).dispatch("get", [key]);
            };

            Promise.prototype.get = function (key) {
                return this.dispatch("get", [key]);
            };

            /**
             * Sets the value of a property in a future turn.
             * @param object    promise or immediate reference for object object
             * @param name      name of property to set
             * @param value     new value of property
             * @return promise for the return value
             */
            Q.set = function (object, key, value) {
                return Q(object).dispatch("set", [key, value]);
            };

            Promise.prototype.set = function (key, value) {
                return this.dispatch("set", [key, value]);
            };

            /**
             * Deletes a property in a future turn.
             * @param object    promise or immediate reference for target object
             * @param name      name of property to delete
             * @return promise for the return value
             */
            Q.del = // XXX legacy
                Q["delete"] = function (object, key) {
                    return Q(object).dispatch("delete", [key]);
                };

            Promise.prototype.del = // XXX legacy
                Promise.prototype["delete"] = function (key) {
                    return this.dispatch("delete", [key]);
                };

            /**
             * Invokes a method in a future turn.
             * @param object    promise or immediate reference for target object
             * @param name      name of method to invoke
             * @param value     a value to post, typically an array of
             *                  invocation arguments for promises that
             *                  are ultimately backed with `resolve` values,
             *                  as opposed to those backed with URLs
             *                  wherein the posted value can be any
             *                  JSON serializable object.
             * @return promise for the return value
             */
            // bound locally because it is used by other methods
            Q.mapply = // XXX As proposed by "Redsandro"
                Q.post = function (object, name, args) {
                    return Q(object).dispatch("post", [name, args]);
                };

            Promise.prototype.mapply = // XXX As proposed by "Redsandro"
                Promise.prototype.post = function (name, args) {
                    return this.dispatch("post", [name, args]);
                };

            /**
             * Invokes a method in a future turn.
             * @param object    promise or immediate reference for target object
             * @param name      name of method to invoke
             * @param ...args   array of invocation arguments
             * @return promise for the return value
             */
            Q.send = // XXX Mark Miller's proposed parlance
                Q.mcall = // XXX As proposed by "Redsandro"
                Q.invoke =
                    function (object, name /*...args*/) {
                        return Q(object).dispatch("post", [
                            name,
                            array_slice(arguments, 2),
                        ]);
                    };

            Promise.prototype.send = // XXX Mark Miller's proposed parlance
                Promise.prototype.mcall = // XXX As proposed by "Redsandro"
                Promise.prototype.invoke =
                    function (name /*...args*/) {
                        return this.dispatch("post", [
                            name,
                            array_slice(arguments, 1),
                        ]);
                    };

            /**
             * Applies the promised function in a future turn.
             * @param object    promise or immediate reference for target function
             * @param args      array of application arguments
             */
            Q.fapply = function (object, args) {
                return Q(object).dispatch("apply", [void 0, args]);
            };

            Promise.prototype.fapply = function (args) {
                return this.dispatch("apply", [void 0, args]);
            };

            /**
             * Calls the promised function in a future turn.
             * @param object    promise or immediate reference for target function
             * @param ...args   array of application arguments
             */
            Q["try"] = Q.fcall = function (object /* ...args*/) {
                return Q(object).dispatch("apply", [
                    void 0,
                    array_slice(arguments, 1),
                ]);
            };

            Promise.prototype.fcall = function (/*...args*/) {
                return this.dispatch("apply", [void 0, array_slice(arguments)]);
            };

            /**
             * Binds the promised function, transforming return values into a fulfilled
             * promise and thrown errors into a rejected one.
             * @param object    promise or immediate reference for target function
             * @param ...args   array of application arguments
             */
            Q.fbind = function (object /*...args*/) {
                var promise = Q(object);
                var args = array_slice(arguments, 1);
                return function fbound() {
                    return promise.dispatch("apply", [
                        this,
                        args.concat(array_slice(arguments)),
                    ]);
                };
            };
            Promise.prototype.fbind = function (/*...args*/) {
                var promise = this;
                var args = array_slice(arguments);
                return function fbound() {
                    return promise.dispatch("apply", [
                        this,
                        args.concat(array_slice(arguments)),
                    ]);
                };
            };

            /**
             * Requests the names of the owned properties of a promised
             * object in a future turn.
             * @param object    promise or immediate reference for target object
             * @return promise for the keys of the eventually settled object
             */
            Q.keys = function (object) {
                return Q(object).dispatch("keys", []);
            };

            Promise.prototype.keys = function () {
                return this.dispatch("keys", []);
            };

            /**
             * Turns an array of promises into a promise for an array.  If any of
             * the promises gets rejected, the whole array is rejected immediately.
             * @param {Array*} an array (or promise for an array) of values (or
             * promises for values)
             * @returns a promise for an array of the corresponding values
             */
            // By Mark Miller
            // http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
            Q.all = all;
            function all(promises) {
                return when(promises, function (promises) {
                    var pendingCount = 0;
                    var deferred = defer();
                    array_reduce(
                        promises,
                        function (undefined, promise, index) {
                            var snapshot;
                            if (
                                isPromise(promise) &&
                                (snapshot = promise.inspect()).state ===
                                    "fulfilled"
                            ) {
                                promises[index] = snapshot.value;
                            } else {
                                ++pendingCount;
                                when(
                                    promise,
                                    function (value) {
                                        promises[index] = value;
                                        if (--pendingCount === 0) {
                                            deferred.resolve(promises);
                                        }
                                    },
                                    deferred.reject,
                                    function (progress) {
                                        deferred.notify({
                                            index: index,
                                            value: progress,
                                        });
                                    }
                                );
                            }
                        },
                        void 0
                    );
                    if (pendingCount === 0) {
                        deferred.resolve(promises);
                    }
                    return deferred.promise;
                });
            }

            Promise.prototype.all = function () {
                return all(this);
            };

            /**
             * Returns the first resolved promise of an array. Prior rejected promises are
             * ignored.  Rejects only if all promises are rejected.
             * @param {Array*} an array containing values or promises for values
             * @returns a promise fulfilled with the value of the first resolved promise,
             * or a rejected promise if all promises are rejected.
             */
            Q.any = any;

            function any(promises) {
                if (promises.length === 0) {
                    return Q.resolve();
                }

                var deferred = Q.defer();
                var pendingCount = 0;
                array_reduce(
                    promises,
                    function (prev, current, index) {
                        var promise = promises[index];

                        pendingCount++;

                        when(promise, onFulfilled, onRejected, onProgress);
                        function onFulfilled(result) {
                            deferred.resolve(result);
                        }
                        function onRejected(err) {
                            pendingCount--;
                            if (pendingCount === 0) {
                                var rejection = err || new Error("" + err);

                                rejection.message =
                                    "Q can't get fulfillment value from any promise, all " +
                                    "promises were rejected. Last error message: " +
                                    rejection.message;

                                deferred.reject(rejection);
                            }
                        }
                        function onProgress(progress) {
                            deferred.notify({
                                index: index,
                                value: progress,
                            });
                        }
                    },
                    undefined
                );

                return deferred.promise;
            }

            Promise.prototype.any = function () {
                return any(this);
            };

            /**
             * Waits for all promises to be settled, either fulfilled or
             * rejected.  This is distinct from `all` since that would stop
             * waiting at the first rejection.  The promise returned by
             * `allResolved` will never be rejected.
             * @param promises a promise for an array (or an array) of promises
             * (or values)
             * @return a promise for an array of promises
             */
            Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
            function allResolved(promises) {
                return when(promises, function (promises) {
                    promises = array_map(promises, Q);
                    return when(
                        all(
                            array_map(promises, function (promise) {
                                return when(promise, noop, noop);
                            })
                        ),
                        function () {
                            return promises;
                        }
                    );
                });
            }

            Promise.prototype.allResolved = function () {
                return allResolved(this);
            };

            /**
             * @see Promise#allSettled
             */
            Q.allSettled = allSettled;
            function allSettled(promises) {
                return Q(promises).allSettled();
            }

            /**
             * Turns an array of promises into a promise for an array of their states (as
             * returned by `inspect`) when they have all settled.
             * @param {Array[Any*]} values an array (or promise for an array) of values (or
             * promises for values)
             * @returns {Array[State]} an array of states for the respective values.
             */
            Promise.prototype.allSettled = function () {
                return this.then(function (promises) {
                    return all(
                        array_map(promises, function (promise) {
                            promise = Q(promise);
                            function regardless() {
                                return promise.inspect();
                            }
                            return promise.then(regardless, regardless);
                        })
                    );
                });
            };

            /**
             * Captures the failure of a promise, giving an oportunity to recover
             * with a callback.  If the given promise is fulfilled, the returned
             * promise is fulfilled.
             * @param {Any*} promise for something
             * @param {Function} callback to fulfill the returned promise if the
             * given promise is rejected
             * @returns a promise for the return value of the callback
             */
            Q.fail = // XXX legacy
                Q["catch"] = function (object, rejected) {
                    return Q(object).then(void 0, rejected);
                };

            Promise.prototype.fail = // XXX legacy
                Promise.prototype["catch"] = function (rejected) {
                    return this.then(void 0, rejected);
                };

            /**
             * Attaches a listener that can respond to progress notifications from a
             * promise's originating deferred. This listener receives the exact arguments
             * passed to ``deferred.notify``.
             * @param {Any*} promise for something
             * @param {Function} callback to receive any progress notifications
             * @returns the given promise, unchanged
             */
            Q.progress = progress;
            function progress(object, progressed) {
                return Q(object).then(void 0, void 0, progressed);
            }

            Promise.prototype.progress = function (progressed) {
                return this.then(void 0, void 0, progressed);
            };

            /**
             * Provides an opportunity to observe the settling of a promise,
             * regardless of whether the promise is fulfilled or rejected.  Forwards
             * the resolution to the returned promise when the callback is done.
             * The callback can return a promise to defer completion.
             * @param {Any*} promise
             * @param {Function} callback to observe the resolution of the given
             * promise, takes no arguments.
             * @returns a promise for the resolution of the given promise when
             * ``fin`` is done.
             */
            Q.fin = // XXX legacy
                Q["finally"] = function (object, callback) {
                    return Q(object)["finally"](callback);
                };

            Promise.prototype.fin = // XXX legacy
                Promise.prototype["finally"] = function (callback) {
                    if (!callback || typeof callback.apply !== "function") {
                        throw new Error("Q can't apply finally callback");
                    }
                    callback = Q(callback);
                    return this.then(
                        function (value) {
                            return callback.fcall().then(function () {
                                return value;
                            });
                        },
                        function (reason) {
                            // TODO attempt to recycle the rejection with "this".
                            return callback.fcall().then(function () {
                                throw reason;
                            });
                        }
                    );
                };

            /**
             * Terminates a chain of promises, forcing rejections to be
             * thrown as exceptions.
             * @param {Any*} promise at the end of a chain of promises
             * @returns nothing
             */
            Q.done = function (object, fulfilled, rejected, progress) {
                return Q(object).done(fulfilled, rejected, progress);
            };

            Promise.prototype.done = function (fulfilled, rejected, progress) {
                var onUnhandledError = function (error) {
                    // forward to a future turn so that ``when``
                    // does not catch it and turn it into a rejection.
                    Q.nextTick(function () {
                        makeStackTraceLong(error, promise);
                        if (Q.onerror) {
                            Q.onerror(error);
                        } else {
                            throw error;
                        }
                    });
                };

                // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
                var promise =
                    fulfilled || rejected || progress
                        ? this.then(fulfilled, rejected, progress)
                        : this;

                if (typeof process === "object" && process && process.domain) {
                    onUnhandledError = process.domain.bind(onUnhandledError);
                }

                promise.then(void 0, onUnhandledError);
            };

            /**
             * Causes a promise to be rejected if it does not get fulfilled before
             * some milliseconds time out.
             * @param {Any*} promise
             * @param {Number} milliseconds timeout
             * @param {Any*} custom error message or Error object (optional)
             * @returns a promise for the resolution of the given promise if it is
             * fulfilled before the timeout, otherwise rejected.
             */
            Q.timeout = function (object, ms, error) {
                return Q(object).timeout(ms, error);
            };

            Promise.prototype.timeout = function (ms, error) {
                var deferred = defer();
                var timeoutId = setTimeout(function () {
                    if (!error || "string" === typeof error) {
                        error = new Error(
                            error || "Timed out after " + ms + " ms"
                        );
                        error.code = "ETIMEDOUT";
                    }
                    deferred.reject(error);
                }, ms);

                this.then(
                    function (value) {
                        clearTimeout(timeoutId);
                        deferred.resolve(value);
                    },
                    function (exception) {
                        clearTimeout(timeoutId);
                        deferred.reject(exception);
                    },
                    deferred.notify
                );

                return deferred.promise;
            };

            /**
             * Returns a promise for the given value (or promised value), some
             * milliseconds after it resolved. Passes rejections immediately.
             * @param {Any*} promise
             * @param {Number} milliseconds
             * @returns a promise for the resolution of the given promise after milliseconds
             * time has elapsed since the resolution of the given promise.
             * If the given promise rejects, that is passed immediately.
             */
            Q.delay = function (object, timeout) {
                if (timeout === void 0) {
                    timeout = object;
                    object = void 0;
                }
                return Q(object).delay(timeout);
            };

            Promise.prototype.delay = function (timeout) {
                return this.then(function (value) {
                    var deferred = defer();
                    setTimeout(function () {
                        deferred.resolve(value);
                    }, timeout);
                    return deferred.promise;
                });
            };

            /**
             * Passes a continuation to a Node function, which is called with the given
             * arguments provided as an array, and returns a promise.
             *
             *      Q.nfapply(FS.readFile, [__filename])
             *      .then(function (content) {
             *      })
             *
             */
            Q.nfapply = function (callback, args) {
                return Q(callback).nfapply(args);
            };

            Promise.prototype.nfapply = function (args) {
                var deferred = defer();
                var nodeArgs = array_slice(args);
                nodeArgs.push(deferred.makeNodeResolver());
                this.fapply(nodeArgs).fail(deferred.reject);
                return deferred.promise;
            };

            /**
             * Passes a continuation to a Node function, which is called with the given
             * arguments provided individually, and returns a promise.
             * @example
             * Q.nfcall(FS.readFile, __filename)
             * .then(function (content) {
             * })
             *
             */
            Q.nfcall = function (callback /*...args*/) {
                var args = array_slice(arguments, 1);
                return Q(callback).nfapply(args);
            };

            Promise.prototype.nfcall = function (/*...args*/) {
                var nodeArgs = array_slice(arguments);
                var deferred = defer();
                nodeArgs.push(deferred.makeNodeResolver());
                this.fapply(nodeArgs).fail(deferred.reject);
                return deferred.promise;
            };

            /**
             * Wraps a NodeJS continuation passing function and returns an equivalent
             * version that returns a promise.
             * @example
             * Q.nfbind(FS.readFile, __filename)("utf-8")
             * .then(console.log)
             * .done()
             */
            Q.nfbind = Q.denodeify = function (callback /*...args*/) {
                if (callback === undefined) {
                    throw new Error("Q can't wrap an undefined function");
                }
                var baseArgs = array_slice(arguments, 1);
                return function () {
                    var nodeArgs = baseArgs.concat(array_slice(arguments));
                    var deferred = defer();
                    nodeArgs.push(deferred.makeNodeResolver());
                    Q(callback).fapply(nodeArgs).fail(deferred.reject);
                    return deferred.promise;
                };
            };

            Promise.prototype.nfbind = Promise.prototype.denodeify =
                function (/*...args*/) {
                    var args = array_slice(arguments);
                    args.unshift(this);
                    return Q.denodeify.apply(void 0, args);
                };

            Q.nbind = function (callback, thisp /*...args*/) {
                var baseArgs = array_slice(arguments, 2);
                return function () {
                    var nodeArgs = baseArgs.concat(array_slice(arguments));
                    var deferred = defer();
                    nodeArgs.push(deferred.makeNodeResolver());
                    function bound() {
                        return callback.apply(thisp, arguments);
                    }
                    Q(bound).fapply(nodeArgs).fail(deferred.reject);
                    return deferred.promise;
                };
            };

            Promise.prototype.nbind = function (/*thisp, ...args*/) {
                var args = array_slice(arguments, 0);
                args.unshift(this);
                return Q.nbind.apply(void 0, args);
            };

            /**
             * Calls a method of a Node-style object that accepts a Node-style
             * callback with a given array of arguments, plus a provided callback.
             * @param object an object that has the named method
             * @param {String} name name of the method of object
             * @param {Array} args arguments to pass to the method; the callback
             * will be provided by Q and appended to these arguments.
             * @returns a promise for the value or error
             */
            Q.nmapply = // XXX As proposed by "Redsandro"
                Q.npost = function (object, name, args) {
                    return Q(object).npost(name, args);
                };

            Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
                Promise.prototype.npost = function (name, args) {
                    var nodeArgs = array_slice(args || []);
                    var deferred = defer();
                    nodeArgs.push(deferred.makeNodeResolver());
                    this.dispatch("post", [name, nodeArgs]).fail(
                        deferred.reject
                    );
                    return deferred.promise;
                };

            /**
             * Calls a method of a Node-style object that accepts a Node-style
             * callback, forwarding the given variadic arguments, plus a provided
             * callback argument.
             * @param object an object that has the named method
             * @param {String} name name of the method of object
             * @param ...args arguments to pass to the method; the callback will
             * be provided by Q and appended to these arguments.
             * @returns a promise for the value or error
             */
            Q.nsend = // XXX Based on Mark Miller's proposed "send"
                Q.nmcall = // XXX Based on "Redsandro's" proposal
                Q.ninvoke =
                    function (object, name /*...args*/) {
                        var nodeArgs = array_slice(arguments, 2);
                        var deferred = defer();
                        nodeArgs.push(deferred.makeNodeResolver());
                        Q(object)
                            .dispatch("post", [name, nodeArgs])
                            .fail(deferred.reject);
                        return deferred.promise;
                    };

            Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
                Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
                Promise.prototype.ninvoke =
                    function (name /*...args*/) {
                        var nodeArgs = array_slice(arguments, 1);
                        var deferred = defer();
                        nodeArgs.push(deferred.makeNodeResolver());
                        this.dispatch("post", [name, nodeArgs]).fail(
                            deferred.reject
                        );
                        return deferred.promise;
                    };

            /**
             * If a function would like to support both Node continuation-passing-style and
             * promise-returning-style, it can end its internal promise chain with
             * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
             * elects to use a nodeback, the result will be sent there.  If they do not
             * pass a nodeback, they will receive the result promise.
             * @param object a result (or a promise for a result)
             * @param {Function} nodeback a Node.js-style callback
             * @returns either the promise or nothing
             */
            Q.nodeify = nodeify;
            function nodeify(object, nodeback) {
                return Q(object).nodeify(nodeback);
            }

            Promise.prototype.nodeify = function (nodeback) {
                if (nodeback) {
                    this.then(
                        function (value) {
                            Q.nextTick(function () {
                                nodeback(null, value);
                            });
                        },
                        function (error) {
                            Q.nextTick(function () {
                                nodeback(error);
                            });
                        }
                    );
                } else {
                    return this;
                }
            };

            Q.noConflict = function () {
                throw new Error(
                    "Q.noConflict only works when Q is used as a global"
                );
            };

            // All code before this point will be filtered from stack traces.
            var qEndingLine = captureLine();

            return Q;
        });
        //#endregion Q Lib

        //#region LargeLocalStorage Lib
        (function (glob) {
            var undefined = {}.a;

            function definition(Q) {
                /**
@author Matt Crinklaw-Vogt
*/
                function PipeContext(handlers, nextMehod, end) {
                    this._handlers = handlers;
                    this._next = nextMehod;
                    this._end = end;

                    this._i = 0;
                }

                PipeContext.prototype = {
                    next: function () {
                        // var args = Array.prototype.slice.call(arguments, 0);
                        // args.unshift(this);
                        this.__pipectx = this;
                        return this._next.apply(this, arguments);
                    },

                    _nextHandler: function () {
                        if (this._i >= this._handlers.length) return this._end;

                        var handler = this._handlers[this._i].handler;
                        this._i += 1;
                        return handler;
                    },

                    length: function () {
                        return this._handlers.length;
                    },
                };

                function indexOfHandler(handlers, len, target) {
                    for (var i = 0; i < len; ++i) {
                        var handler = handlers[i];
                        if (
                            handler.name === target ||
                            handler.handler === target
                        ) {
                            return i;
                        }
                    }

                    return -1;
                }

                function forward(ctx) {
                    return ctx.next.apply(
                        ctx,
                        Array.prototype.slice.call(arguments, 1)
                    );
                }

                function coerce(methodNames, handler) {
                    methodNames.forEach(function (meth) {
                        if (!handler[meth]) handler[meth] = forward;
                    });
                }

                var abstractPipeline = {
                    addFirst: function (name, handler) {
                        coerce(this._pipedMethodNames, handler);
                        this._handlers.unshift({
                            name: name,
                            handler: handler,
                        });
                    },

                    addLast: function (name, handler) {
                        coerce(this._pipedMethodNames, handler);
                        this._handlers.push({ name: name, handler: handler });
                    },

                    /**
 	Add the handler with the given name after the
 	handler specified by target.  Target can be a handler
 	name or a handler instance.
 	*/
                    addAfter: function (target, name, handler) {
                        coerce(this._pipedMethodNames, handler);
                        var handlers = this._handlers;
                        var len = handlers.length;
                        var i = indexOfHandler(handlers, len, target);

                        if (i >= 0) {
                            handlers.splice(i + 1, 0, {
                                name: name,
                                handler: handler,
                            });
                        }
                    },

                    /**
	Add the handler with the given name after the handler
	specified by target.  Target can be a handler name or
	a handler instance.
	*/
                    addBefore: function (target, name, handler) {
                        coerce(this._pipedMethodNames, handler);
                        var handlers = this._handlers;
                        var len = handlers.length;
                        var i = indexOfHandler(handlers, len, target);

                        if (i >= 0) {
                            handlers.splice(i, 0, {
                                name: name,
                                handler: handler,
                            });
                        }
                    },

                    /**
	Replace the handler specified by target.
	*/
                    replace: function (target, newName, handler) {
                        coerce(this._pipedMethodNames, handler);
                        var handlers = this._handlers;
                        var len = handlers.length;
                        var i = indexOfHandler(handlers, len, target);

                        if (i >= 0) {
                            handlers.splice(i, 1, {
                                name: newName,
                                handler: handler,
                            });
                        }
                    },

                    removeFirst: function () {
                        return this._handlers.shift();
                    },

                    removeLast: function () {
                        return this._handlers.pop();
                    },

                    remove: function (target) {
                        var handlers = this._handlers;
                        var len = handlers.length;
                        var i = indexOfHandler(handlers, len, target);

                        if (i >= 0) handlers.splice(i, 1);
                    },

                    getHandler: function (name) {
                        var i = indexOfHandler(
                            this._handlers,
                            this._handlers.length,
                            name
                        );
                        if (i >= 0) return this._handlers[i].handler;
                        return null;
                    },
                };

                function createPipeline(pipedMethodNames) {
                    var end = {};
                    var endStubFunc = function () {
                        return end;
                    };
                    var nextMethods = {};

                    function Pipeline(pipedMethodNames) {
                        this.pipe = {
                            _handlers: [],
                            _contextCtor: PipeContext,
                            _nextMethods: nextMethods,
                            end: end,
                            _pipedMethodNames: pipedMethodNames,
                        };
                    }

                    var pipeline = new Pipeline(pipedMethodNames);
                    for (var k in abstractPipeline) {
                        pipeline.pipe[k] = abstractPipeline[k];
                    }

                    pipedMethodNames.forEach(function (name) {
                        end[name] = endStubFunc;

                        nextMethods[name] = new Function(
                            "var handler = this._nextHandler();" +
                                "handler.__pipectx = this.__pipectx;" +
                                "return handler." +
                                name +
                                ".apply(handler, arguments);"
                        );

                        pipeline[name] = new Function(
                            "var ctx = new this.pipe._contextCtor(this.pipe._handlers, this.pipe._nextMethods." +
                                name +
                                ", this.pipe.end);" +
                                "return ctx.next.apply(ctx, arguments);"
                        );
                    });

                    return pipeline;
                }

                createPipeline.isPipeline = function (obj) {
                    return obj instanceof Pipeline;
                };
                var utils = (function () {
                    return {
                        convertToBase64: function (blob, cb) {
                            var fr = new FileReader();
                            fr.onload = function (e) {
                                cb(e.target.result);
                            };
                            fr.onerror = function (e) {};
                            fr.onabort = function (e) {};
                            fr.readAsDataURL(blob);
                        },

                        dataURLToBlob: function (dataURL) {
                            var BASE64_MARKER = ";base64,";
                            if (dataURL.indexOf(BASE64_MARKER) == -1) {
                                var parts = dataURL.split(",");
                                var contentType = parts[0].split(":")[1];
                                var raw = parts[1];

                                return new Blob([raw], { type: contentType });
                            }

                            var parts = dataURL.split(BASE64_MARKER);
                            var contentType = parts[0].split(":")[1];
                            var raw = window.atob(parts[1]);
                            var rawLength = raw.length;

                            var uInt8Array = new Uint8Array(rawLength);

                            for (var i = 0; i < rawLength; ++i) {
                                uInt8Array[i] = raw.charCodeAt(i);
                            }

                            return new Blob([uInt8Array.buffer], {
                                type: contentType,
                            });
                        },

                        splitAttachmentPath: function (path) {
                            var parts = path.split("/");
                            if (parts.length == 1) parts.unshift("__nodoc__");
                            return parts;
                        },

                        mapAsync: function (fn, promise) {
                            var deferred = Q.defer();
                            promise.then(
                                function (data) {
                                    _mapAsync(fn, data, [], deferred);
                                },
                                function (e) {
                                    deferred.reject(e);
                                }
                            );

                            return deferred.promise;
                        },

                        countdown: function (n, cb) {
                            var args = [];
                            return function () {
                                for (var i = 0; i < arguments.length; ++i)
                                    args.push(arguments[i]);
                                n -= 1;
                                if (n == 0) cb.apply(this, args);
                            };
                        },
                    };

                    function _mapAsync(fn, data, result, deferred) {
                        fn(
                            data[result.length],
                            function (v) {
                                result.push(v);
                                if (result.length == data.length)
                                    deferred.resolve(result);
                                else _mapAsync(fn, data, result, deferred);
                            },
                            function (err) {
                                deferred.reject(err);
                            }
                        );
                    }
                })();
                var requestFileSystem =
                    window.requestFileSystem || window.webkitRequestFileSystem;
                var persistentStorage =
                    navigator.persistentStorage ||
                    navigator.webkitPersistentStorage;
                var FilesystemAPIProvider = (function (Q) {
                    function makeErrorHandler(deferred, finalDeferred) {
                        // TODO: normalize the error so
                        // we can handle it upstream
                        return function (e) {
                            if (e.code == 1) {
                                deferred.resolve(undefined);
                            } else {
                                if (finalDeferred) finalDeferred.reject(e);
                                else deferred.reject(e);
                            }
                        };
                    }

                    function getAttachmentPath(docKey, attachKey) {
                        docKey = docKey.replace(/\//g, "--");
                        var attachmentsDir = docKey + "-attachments";
                        return {
                            dir: attachmentsDir,
                            path: attachmentsDir + "/" + attachKey,
                        };
                    }

                    function readDirEntries(reader, result) {
                        var deferred = Q.defer();

                        _readDirEntries(reader, result, deferred);

                        return deferred.promise;
                    }

                    function _readDirEntries(reader, result, deferred) {
                        reader.readEntries(
                            function (entries) {
                                if (entries.length == 0) {
                                    deferred.resolve(result);
                                } else {
                                    result = result.concat(entries);
                                    _readDirEntries(reader, result, deferred);
                                }
                            },
                            function (err) {
                                deferred.reject(err);
                            }
                        );
                    }

                    function entryToFile(entry, cb, eb) {
                        entry.file(cb, eb);
                    }

                    function entryToURL(entry) {
                        return entry.toURL();
                    }

                    function FSAPI(fs, numBytes, prefix) {
                        this._fs = fs;
                        this._capacity = numBytes;
                        this._prefix = prefix;
                        this.type = "FileSystemAPI";
                    }

                    FSAPI.prototype = {
                        getContents: function (path, options) {
                            var deferred = Q.defer();
                            path = this._prefix + path;
                            this._fs.root.getFile(
                                path,
                                {},
                                function (fileEntry) {
                                    fileEntry.file(function (file) {
                                        var reader = new FileReader();

                                        reader.onloadend = function (e) {
                                            var data = e.target.result;
                                            var err;
                                            if (options && options.json) {
                                                try {
                                                    data = JSON.parse(data);
                                                } catch (e) {
                                                    err = new Error(
                                                        "unable to parse JSON for " +
                                                            path
                                                    );
                                                }
                                            }

                                            if (err) {
                                                deferred.reject(err);
                                            } else {
                                                deferred.resolve(data);
                                            }
                                        };

                                        reader.readAsText(file);
                                    }, makeErrorHandler(deferred));
                                },
                                makeErrorHandler(deferred)
                            );

                            return deferred.promise;
                        },

                        // create a file at path
                        // and write `data` to it
                        setContents: function (path, data, options) {
                            var deferred = Q.defer();

                            if (options && options.json)
                                data = JSON.stringify(data);

                            path = this._prefix + path;
                            this._fs.root.getFile(
                                path,
                                { create: true },
                                function (fileEntry) {
                                    fileEntry.createWriter(function (
                                        fileWriter
                                    ) {
                                        var blob;
                                        fileWriter.onwriteend = function (e) {
                                            fileWriter.onwriteend =
                                                function () {
                                                    deferred.resolve();
                                                };
                                            fileWriter.truncate(blob.size);
                                        };

                                        fileWriter.onerror =
                                            makeErrorHandler(deferred);

                                        if (data instanceof Blob) {
                                            blob = data;
                                        } else {
                                            blob = new Blob([data], {
                                                type: "text/plain",
                                            });
                                        }

                                        fileWriter.write(blob);
                                    },
                                    makeErrorHandler(deferred));
                                },
                                makeErrorHandler(deferred)
                            );

                            return deferred.promise;
                        },

                        ls: function (docKey) {
                            var isRoot = false;
                            if (!docKey) {
                                docKey = this._prefix;
                                isRoot = true;
                            } else
                                docKey = this._prefix + docKey + "-attachments";

                            var deferred = Q.defer();

                            this._fs.root.getDirectory(
                                docKey,
                                { create: false },
                                function (entry) {
                                    var reader = entry.createReader();
                                    readDirEntries(reader, []).then(function (
                                        entries
                                    ) {
                                        var listing = [];
                                        entries.forEach(function (entry) {
                                            if (!entry.isDirectory) {
                                                listing.push(entry.name);
                                            }
                                        });
                                        deferred.resolve(listing);
                                    });
                                },
                                function (error) {
                                    deferred.reject(error);
                                }
                            );

                            return deferred.promise;
                        },

                        clear: function () {
                            var deferred = Q.defer();
                            var failed = false;
                            var ecb = function (err) {
                                failed = true;
                                deferred.reject(err);
                            };

                            this._fs.root.getDirectory(
                                this._prefix,
                                {},
                                function (entry) {
                                    var reader = entry.createReader();
                                    reader.readEntries(function (entries) {
                                        var latch = utils.countdown(
                                            entries.length,
                                            function () {
                                                if (!failed) deferred.resolve();
                                            }
                                        );

                                        entries.forEach(function (entry) {
                                            if (entry.isDirectory) {
                                                entry.removeRecursively(
                                                    latch,
                                                    ecb
                                                );
                                            } else {
                                                entry.remove(latch, ecb);
                                            }
                                        });

                                        if (entries.length == 0)
                                            deferred.resolve();
                                    }, ecb);
                                },
                                ecb
                            );

                            return deferred.promise;
                        },

                        rm: function (path) {
                            var deferred = Q.defer();
                            var finalDeferred = Q.defer();

                            // remove attachments that go along with the path
                            path = this._prefix + path;
                            var attachmentsDir = path + "-attachments";

                            this._fs.root.getFile(
                                path,
                                { create: false },
                                function (entry) {
                                    entry.remove(
                                        function () {
                                            deferred.promise.then(
                                                finalDeferred.resolve
                                            );
                                        },
                                        function (err) {
                                            finalDeferred.reject(err);
                                        }
                                    );
                                },
                                makeErrorHandler(finalDeferred)
                            );

                            this._fs.root.getDirectory(
                                attachmentsDir,
                                {},
                                function (entry) {
                                    entry.removeRecursively(
                                        function () {
                                            deferred.resolve();
                                        },
                                        function (err) {
                                            finalDeferred.reject(err);
                                        }
                                    );
                                },
                                makeErrorHandler(deferred, finalDeferred)
                            );

                            return finalDeferred.promise;
                        },

                        getAttachment: function (docKey, attachKey) {
                            var attachmentPath =
                                this._prefix +
                                getAttachmentPath(docKey, attachKey).path;

                            var deferred = Q.defer();
                            this._fs.root.getFile(
                                attachmentPath,
                                {},
                                function (fileEntry) {
                                    fileEntry.file(function (file) {
                                        if (file.size == 0)
                                            deferred.resolve(undefined);
                                        else deferred.resolve(file);
                                    }, makeErrorHandler(deferred));
                                },
                                function (err) {
                                    if (err.code == 1) {
                                        deferred.resolve(undefined);
                                    } else {
                                        deferred.reject(err);
                                    }
                                }
                            );

                            return deferred.promise;
                        },

                        getAttachmentURL: function (docKey, attachKey) {
                            var attachmentPath =
                                this._prefix +
                                getAttachmentPath(docKey, attachKey).path;

                            var deferred = Q.defer();
                            var url =
                                "filesystem:" +
                                window.location.protocol +
                                "//" +
                                window.location.host +
                                "/persistent/" +
                                attachmentPath;
                            deferred.resolve(url);
                            // this._fs.root.getFile(attachmentPath, {}, function(fileEntry) {
                            // 	deferred.resolve(fileEntry.toURL());
                            // }, makeErrorHandler(deferred, "getting attachment file entry"));

                            return deferred.promise;
                        },

                        getAllAttachments: function (docKey) {
                            var deferred = Q.defer();
                            var attachmentsDir =
                                this._prefix + docKey + "-attachments";

                            this._fs.root.getDirectory(
                                attachmentsDir,
                                {},
                                function (entry) {
                                    var reader = entry.createReader();
                                    deferred.resolve(
                                        utils.mapAsync(function (
                                            entry,
                                            cb,
                                            eb
                                        ) {
                                            entry.file(function (file) {
                                                cb({
                                                    data: file,
                                                    docKey: docKey,
                                                    attachKey: entry.name,
                                                });
                                            }, eb);
                                        },
                                        readDirEntries(reader, []))
                                    );
                                },
                                function (err) {
                                    deferred.resolve([]);
                                }
                            );

                            return deferred.promise;
                        },

                        getAllAttachmentURLs: function (docKey) {
                            var deferred = Q.defer();
                            var attachmentsDir =
                                this._prefix + docKey + "-attachments";

                            this._fs.root.getDirectory(
                                attachmentsDir,
                                {},
                                function (entry) {
                                    var reader = entry.createReader();
                                    readDirEntries(reader, []).then(function (
                                        entries
                                    ) {
                                        deferred.resolve(
                                            entries.map(function (entry) {
                                                return {
                                                    url: entry.toURL(),
                                                    docKey: docKey,
                                                    attachKey: entry.name,
                                                };
                                            })
                                        );
                                    });
                                },
                                function (err) {
                                    deferred.reject(err);
                                }
                            );

                            return deferred.promise;
                        },

                        revokeAttachmentURL: function (url) {
                            // we return FS urls so this is a no-op
                            // unless someone is being silly and doing
                            // createObjectURL(getAttachment()) ......
                        },

                        // Create a folder at dirname(path)+"-attachments"
                        // add attachment under that folder as basename(path)
                        setAttachment: function (docKey, attachKey, data) {
                            var attachInfo = getAttachmentPath(
                                docKey,
                                attachKey
                            );

                            var deferred = Q.defer();

                            var self = this;
                            this._fs.root.getDirectory(
                                this._prefix + attachInfo.dir,
                                { create: true },
                                function (dirEntry) {
                                    deferred.resolve(
                                        self.setContents(attachInfo.path, data)
                                    );
                                },
                                makeErrorHandler(deferred)
                            );

                            return deferred.promise;
                        },

                        // rm the thing at dirname(path)+"-attachments/"+basename(path)
                        rmAttachment: function (docKey, attachKey) {
                            var attachmentPath = getAttachmentPath(
                                docKey,
                                attachKey
                            ).path;

                            var deferred = Q.defer();
                            this._fs.root.getFile(
                                this._prefix + attachmentPath,
                                { create: false },
                                function (entry) {
                                    entry.remove(function () {
                                        deferred.resolve();
                                    }, makeErrorHandler(deferred));
                                },
                                makeErrorHandler(deferred)
                            );

                            return deferred.promise;
                        },

                        getCapacity: function () {
                            return this._capacity;
                        },
                    };

                    return {
                        init: function (config) {
                            var deferred = Q.defer();

                            if (!requestFileSystem) {
                                deferred.reject("No FS API");
                                return deferred.promise;
                            }

                            var prefix = config.name + "/";

                            persistentStorage.requestQuota(
                                config.size,
                                function (numBytes) {
                                    requestFileSystem(
                                        window.PERSISTENT,
                                        numBytes,
                                        function (fs) {
                                            fs.root.getDirectory(
                                                config.name,
                                                { create: true },
                                                function () {
                                                    deferred.resolve(
                                                        new FSAPI(
                                                            fs,
                                                            numBytes,
                                                            prefix
                                                        )
                                                    );
                                                },
                                                function (err) {
                                                    console.error(err);
                                                    deferred.reject(err);
                                                }
                                            );
                                        },
                                        function (err) {
                                            // TODO: implement various error messages.
                                            console.error(err);
                                            deferred.reject(err);
                                        }
                                    );
                                },
                                function (err) {
                                    // TODO: implement various error messages.
                                    console.error(err);
                                    deferred.reject(err);
                                }
                            );

                            return deferred.promise;
                        },

                        isAvailable: function () {
                            return requestFileSystem != null;
                        },
                    };
                })(Q);
                var indexedDB =
                    window.indexedDB ||
                    window.webkitIndexedDB ||
                    window.mozIndexedDB ||
                    window.OIndexedDB ||
                    window.msIndexedDB;
                var IDBTransaction =
                    window.IDBTransaction ||
                    window.webkitIDBTransaction ||
                    window.OIDBTransaction ||
                    window.msIDBTransaction;
                var IndexedDBProvider = (function (Q) {
                    var URL = window.URL || window.webkitURL;

                    var convertToBase64 = utils.convertToBase64;
                    var dataURLToBlob = utils.dataURLToBlob;

                    function IDB(db) {
                        this._db = db;
                        this.type = "IndexedDB";

                        var transaction = this._db.transaction(
                            ["attachments"],
                            "readwrite"
                        );
                        this._supportsBlobs = true;
                        try {
                            transaction
                                .objectStore("attachments")
                                .put(
                                    Blob(["sdf"], { type: "text/plain" }),
                                    "featurecheck"
                                );
                        } catch (e) {
                            this._supportsBlobs = false;
                        }
                    }

                    // TODO: normalize returns and errors.
                    IDB.prototype = {
                        getContents: function (docKey) {
                            var deferred = Q.defer();
                            var transaction = this._db.transaction(
                                ["files"],
                                "readonly"
                            );

                            var get = transaction
                                .objectStore("files")
                                .get(docKey);
                            get.onsuccess = function (e) {
                                deferred.resolve(e.target.result);
                            };

                            get.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return deferred.promise;
                        },

                        setContents: function (docKey, data) {
                            var deferred = Q.defer();
                            var transaction = this._db.transaction(
                                ["files"],
                                "readwrite"
                            );

                            var put = transaction
                                .objectStore("files")
                                .put(data, docKey);
                            put.onsuccess = function (e) {
                                deferred.resolve(e);
                            };

                            put.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return deferred.promise;
                        },

                        rm: function (docKey) {
                            var deferred = Q.defer();
                            var finalDeferred = Q.defer();

                            var transaction = this._db.transaction(
                                ["files", "attachments"],
                                "readwrite"
                            );

                            var del = transaction
                                .objectStore("files")
                                .delete(docKey);

                            del.onsuccess = function (e) {
                                deferred.promise.then(function () {
                                    finalDeferred.resolve();
                                });
                            };

                            del.onerror = function (e) {
                                deferred.promise.catch(function () {
                                    finalDeferred.reject(e);
                                });
                            };

                            var attachmentsStore =
                                transaction.objectStore("attachments");
                            var index = attachmentsStore.index("fname");
                            var cursor = index.openCursor(
                                IDBKeyRange.only(docKey)
                            );
                            cursor.onsuccess = function (e) {
                                var cursor = e.target.result;
                                if (cursor) {
                                    cursor.delete();
                                    cursor.continue();
                                } else {
                                    deferred.resolve();
                                }
                            };

                            cursor.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return finalDeferred.promise;
                        },

                        getAttachment: function (docKey, attachKey) {
                            var deferred = Q.defer();

                            var transaction = this._db.transaction(
                                ["attachments"],
                                "readonly"
                            );
                            var get = transaction
                                .objectStore("attachments")
                                .get(docKey + "/" + attachKey);

                            var self = this;
                            get.onsuccess = function (e) {
                                if (!e.target.result) {
                                    deferred.resolve(undefined);
                                    return;
                                }

                                var data = e.target.result.data;
                                if (!self._supportsBlobs) {
                                    data = dataURLToBlob(data);
                                }
                                deferred.resolve(data);
                            };

                            get.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return deferred.promise;
                        },

                        ls: function (docKey) {
                            var deferred = Q.defer();

                            if (!docKey) {
                                // list docs
                                var store = "files";
                            } else {
                                // list attachments
                                var store = "attachments";
                            }

                            var transaction = this._db.transaction(
                                [store],
                                "readonly"
                            );
                            var cursor = transaction
                                .objectStore(store)
                                .openCursor();
                            var listing = [];

                            cursor.onsuccess = function (e) {
                                var cursor = e.target.result;
                                if (cursor) {
                                    listing.push(
                                        !docKey
                                            ? cursor.key
                                            : cursor.key.split("/")[1]
                                    );
                                    cursor.continue();
                                } else {
                                    deferred.resolve(listing);
                                }
                            };

                            cursor.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return deferred.promise;
                        },

                        clear: function () {
                            var deferred = Q.defer();
                            var finalDeferred = Q.defer();

                            var t = this._db.transaction(
                                ["attachments", "files"],
                                "readwrite"
                            );

                            var req1 = t.objectStore("attachments").clear();
                            var req2 = t.objectStore("files").clear();

                            req1.onsuccess = function () {
                                deferred.promise.then(finalDeferred.resolve);
                            };

                            req2.onsuccess = function () {
                                deferred.resolve();
                            };

                            req1.onerror = function (err) {
                                finalDeferred.reject(err);
                            };

                            req2.onerror = function (err) {
                                finalDeferred.reject(err);
                            };

                            return finalDeferred.promise;
                        },

                        getAllAttachments: function (docKey) {
                            var deferred = Q.defer();
                            var self = this;

                            var transaction = this._db.transaction(
                                ["attachments"],
                                "readonly"
                            );
                            var index = transaction
                                .objectStore("attachments")
                                .index("fname");

                            var cursor = index.openCursor(
                                IDBKeyRange.only(docKey)
                            );
                            var values = [];
                            cursor.onsuccess = function (e) {
                                var cursor = e.target.result;
                                if (cursor) {
                                    var data;
                                    if (!self._supportsBlobs) {
                                        data = dataURLToBlob(cursor.value.data);
                                    } else {
                                        data = cursor.value.data;
                                    }
                                    values.push({
                                        data: data,
                                        docKey: docKey,
                                        attachKey:
                                            cursor.primaryKey.split("/")[1], // TODO
                                    });
                                    cursor.continue();
                                } else {
                                    deferred.resolve(values);
                                }
                            };

                            cursor.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return deferred.promise;
                        },

                        getAllAttachmentURLs: function (docKey) {
                            var deferred = Q.defer();
                            this.getAllAttachments(docKey).then(
                                function (attachments) {
                                    var urls = attachments.map(function (a) {
                                        a.url = URL.createObjectURL(a.data);
                                        delete a.data;
                                        return a;
                                    });

                                    deferred.resolve(urls);
                                },
                                function (e) {
                                    deferred.reject(e);
                                }
                            );

                            return deferred.promise;
                        },

                        getAttachmentURL: function (docKey, attachKey) {
                            var deferred = Q.defer();
                            this.getAttachment(docKey, attachKey).then(
                                function (attachment) {
                                    deferred.resolve(
                                        URL.createObjectURL(attachment)
                                    );
                                },
                                function (e) {
                                    deferred.reject(e);
                                }
                            );

                            return deferred.promise;
                        },

                        revokeAttachmentURL: function (url) {
                            URL.revokeObjectURL(url);
                        },

                        setAttachment: function (docKey, attachKey, data) {
                            var deferred = Q.defer();

                            if (data instanceof Blob && !this._supportsBlobs) {
                                var self = this;
                                convertToBase64(data, function (data) {
                                    continuation.call(self, data);
                                });
                            } else {
                                continuation.call(this, data);
                            }

                            function continuation(data) {
                                var obj = {
                                    path: docKey + "/" + attachKey,
                                    fname: docKey,
                                    data: data,
                                };
                                var transaction = this._db.transaction(
                                    ["attachments"],
                                    "readwrite"
                                );
                                var put = transaction
                                    .objectStore("attachments")
                                    .put(obj);

                                put.onsuccess = function (e) {
                                    deferred.resolve(e);
                                };

                                put.onerror = function (e) {
                                    deferred.reject(e);
                                };
                            }

                            return deferred.promise;
                        },

                        rmAttachment: function (docKey, attachKey) {
                            var deferred = Q.defer();
                            var transaction = this._db.transaction(
                                ["attachments"],
                                "readwrite"
                            );
                            var del = transaction
                                .objectStore("attachments")
                                .delete(docKey + "/" + attachKey);

                            del.onsuccess = function (e) {
                                deferred.resolve(e);
                            };

                            del.onerror = function (e) {
                                deferred.reject(e);
                            };

                            return deferred.promise;
                        },
                    };

                    return {
                        init: function (config) {
                            var deferred = Q.defer();
                            var dbVersion = 2;

                            if (!indexedDB || !IDBTransaction) {
                                deferred.reject("No IndexedDB");
                                return deferred.promise;
                            }

                            var request = indexedDB.open(
                                config.name,
                                dbVersion
                            );

                            function createObjectStore(db) {
                                db.createObjectStore("files");
                                var attachStore = db.createObjectStore(
                                    "attachments",
                                    { keyPath: "path" }
                                );
                                attachStore.createIndex("fname", "fname", {
                                    unique: false,
                                });
                            }

                            // TODO: normalize errors
                            request.onerror = function (event) {
                                deferred.reject(event);
                            };

                            request.onsuccess = function (event) {
                                var db = request.result;

                                db.onerror = function (event) {
                                    console.log(event);
                                };

                                // Chrome workaround
                                if (db.setVersion) {
                                    if (db.version != dbVersion) {
                                        var setVersion =
                                            db.setVersion(dbVersion);
                                        setVersion.onsuccess = function () {
                                            createObjectStore(db);
                                            deferred.resolve();
                                        };
                                    } else {
                                        deferred.resolve(new IDB(db));
                                    }
                                } else {
                                    deferred.resolve(new IDB(db));
                                }
                            };

                            request.onupgradeneeded = function (event) {
                                createObjectStore(event.target.result);
                            };

                            return deferred.promise;
                        },

                        isAvailable: function () {
                            return indexedDB != null && IDBTransaction != null;
                        },
                    };
                })(Q);
                var LocalStorageProvider = (function (Q) {
                    return {
                        init: function () {
                            return Q({ type: "LocalStorage" });
                        },
                    };
                })(Q);
                var openDb = window.openDatabase;
                var WebSQLProvider = (function (Q) {
                    var URL = window.URL || window.webkitURL;
                    var convertToBase64 = utils.convertToBase64;
                    var dataURLToBlob = utils.dataURLToBlob;

                    function WSQL(db) {
                        this._db = db;
                        this.type = "WebSQL";
                    }

                    WSQL.prototype = {
                        getContents: function (docKey, options) {
                            var deferred = Q.defer();
                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "SELECT value FROM files WHERE fname = ?",
                                        [docKey],
                                        function (tx, res) {
                                            if (res.rows.length == 0) {
                                                deferred.resolve(undefined);
                                            } else {
                                                var data =
                                                    res.rows.item(0).value;
                                                if (options && options.json)
                                                    data = JSON.parse(data);
                                                deferred.resolve(data);
                                            }
                                        }
                                    );
                                },
                                function (err) {
                                    consol.log(err);
                                    deferred.reject(err);
                                }
                            );

                            return deferred.promise;
                        },

                        setContents: function (docKey, data, options) {
                            var deferred = Q.defer();
                            if (options && options.json)
                                data = JSON.stringify(data);

                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "INSERT OR REPLACE INTO files (fname, value) VALUES(?, ?)",
                                        [docKey, data]
                                    );
                                },
                                function (err) {
                                    console.log(err);
                                    deferred.reject(err);
                                },
                                function () {
                                    deferred.resolve();
                                }
                            );

                            return deferred.promise;
                        },

                        rm: function (docKey) {
                            var deferred = Q.defer();

                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "DELETE FROM files WHERE fname = ?",
                                        [docKey]
                                    );
                                    tx.executeSql(
                                        "DELETE FROM attachments WHERE fname = ?",
                                        [docKey]
                                    );
                                },
                                function (err) {
                                    console.log(err);
                                    deferred.reject(err);
                                },
                                function () {
                                    deferred.resolve();
                                }
                            );

                            return deferred.promise;
                        },

                        getAttachment: function (fname, akey) {
                            var deferred = Q.defer();

                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "SELECT value FROM attachments WHERE fname = ? AND akey = ?",
                                        [fname, akey],
                                        function (tx, res) {
                                            if (res.rows.length == 0) {
                                                deferred.resolve(undefined);
                                            } else {
                                                deferred.resolve(
                                                    dataURLToBlob(
                                                        res.rows.item(0).value
                                                    )
                                                );
                                            }
                                        }
                                    );
                                },
                                function (err) {
                                    deferred.reject(err);
                                }
                            );

                            return deferred.promise;
                        },

                        getAttachmentURL: function (docKey, attachKey) {
                            var deferred = Q.defer();
                            this.getAttachment(docKey, attachKey).then(
                                function (blob) {
                                    deferred.resolve(URL.createObjectURL(blob));
                                },
                                function () {
                                    deferred.reject();
                                }
                            );

                            return deferred.promise;
                        },

                        ls: function (docKey) {
                            var deferred = Q.defer();

                            var select;
                            var field;
                            if (!docKey) {
                                select = "SELECT fname FROM files";
                                field = "fname";
                            } else {
                                select =
                                    "SELECT akey FROM attachments WHERE fname = ?";
                                field = "akey";
                            }

                            this._db.transaction(function (tx) {
                                tx.executeSql(
                                    select,
                                    docKey ? [docKey] : [],
                                    function (tx, res) {
                                        var listing = [];
                                        for (
                                            var i = 0;
                                            i < res.rows.length;
                                            ++i
                                        ) {
                                            listing.push(
                                                res.rows.item(i)[field]
                                            );
                                        }

                                        deferred.resolve(listing);
                                    },
                                    function (err) {
                                        deferred.reject(err);
                                    }
                                );
                            });

                            return deferred.promise;
                        },

                        clear: function () {
                            var deffered1 = Q.defer();
                            var deffered2 = Q.defer();

                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "DELETE FROM files",
                                        function () {
                                            deffered1.resolve();
                                        }
                                    );
                                    tx.executeSql(
                                        "DELETE FROM attachments",
                                        function () {
                                            deffered2.resolve();
                                        }
                                    );
                                },
                                function (err) {
                                    deffered1.reject(err);
                                    deffered2.reject(err);
                                }
                            );

                            return Q.all([deffered1, deffered2]);
                        },

                        getAllAttachments: function (fname) {
                            var deferred = Q.defer();

                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "SELECT value, akey FROM attachments WHERE fname = ?",
                                        [fname],
                                        function (tx, res) {
                                            // TODO: ship this work off to a webworker
                                            // since there could be many of these conversions?
                                            var result = [];
                                            for (
                                                var i = 0;
                                                i < res.rows.length;
                                                ++i
                                            ) {
                                                var item = res.rows.item(i);
                                                result.push({
                                                    docKey: fname,
                                                    attachKey: item.akey,
                                                    data: dataURLToBlob(
                                                        item.value
                                                    ),
                                                });
                                            }

                                            deferred.resolve(result);
                                        }
                                    );
                                },
                                function (err) {
                                    deferred.reject(err);
                                }
                            );

                            return deferred.promise;
                        },

                        getAllAttachmentURLs: function (fname) {
                            var deferred = Q.defer();
                            this.getAllAttachments(fname).then(
                                function (attachments) {
                                    var urls = attachments.map(function (a) {
                                        a.url = URL.createObjectURL(a.data);
                                        delete a.data;
                                        return a;
                                    });

                                    deferred.resolve(urls);
                                },
                                function (e) {
                                    deferred.reject(e);
                                }
                            );

                            return deferred.promise;
                        },

                        revokeAttachmentURL: function (url) {
                            URL.revokeObjectURL(url);
                        },

                        setAttachment: function (fname, akey, data) {
                            var deferred = Q.defer();

                            var self = this;
                            convertToBase64(data, function (data) {
                                self._db.transaction(
                                    function (tx) {
                                        tx.executeSql(
                                            "INSERT OR REPLACE INTO attachments (fname, akey, value) VALUES(?, ?, ?)",
                                            [fname, akey, data]
                                        );
                                    },
                                    function (err) {
                                        deferred.reject(err);
                                    },
                                    function () {
                                        deferred.resolve();
                                    }
                                );
                            });

                            return deferred.promise;
                        },

                        rmAttachment: function (fname, akey) {
                            var deferred = Q.defer();
                            this._db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "DELETE FROM attachments WHERE fname = ? AND akey = ?",
                                        [fname, akey]
                                    );
                                },
                                function (err) {
                                    deferred.reject(err);
                                },
                                function () {
                                    deferred.resolve();
                                }
                            );

                            return deferred.promise;
                        },
                    };

                    return {
                        init: function (config) {
                            var deferred = Q.defer();
                            if (!openDb) {
                                deferred.reject("No WebSQL");
                                return deferred.promise;
                            }

                            var db = openDb(
                                config.name,
                                "1.0",
                                "large local storage",
                                config.size
                            );

                            db.transaction(
                                function (tx) {
                                    tx.executeSql(
                                        "CREATE TABLE IF NOT EXISTS files (fname unique, value)"
                                    );
                                    tx.executeSql(
                                        "CREATE TABLE IF NOT EXISTS attachments (fname, akey, value)"
                                    );
                                    tx.executeSql(
                                        "CREATE INDEX IF NOT EXISTS fname_index ON attachments (fname)"
                                    );
                                    tx.executeSql(
                                        "CREATE INDEX IF NOT EXISTS akey_index ON attachments (akey)"
                                    );
                                    tx.executeSql(
                                        "CREATE UNIQUE INDEX IF NOT EXISTS uniq_attach ON attachments (fname, akey)"
                                    );
                                },
                                function (err) {
                                    deferred.reject(err);
                                },
                                function () {
                                    deferred.resolve(new WSQL(db));
                                }
                            );

                            return deferred.promise;
                        },

                        isAvailable: function () {
                            return openDb != null;
                        },
                    };
                })(Q);
                var LargeLocalStorage = (function (Q) {
                    var sessionMeta = window.localStorage.getItem(
                        "LargeLocalStorage-meta"
                    );
                    if (sessionMeta) sessionMeta = JSON.parse(sessionMeta);
                    else sessionMeta = {};

                    window.addEventListener("beforeunload", function () {
                        localStorage.setItem(
                            "LargeLocalStorage-meta",
                            JSON.stringify(sessionMeta)
                        );
                    });

                    function defaults(options, defaultOptions) {
                        for (var k in defaultOptions) {
                            if (options[k] === undefined)
                                options[k] = defaultOptions[k];
                        }

                        return options;
                    }

                    var providers = {
                        FileSystemAPI: FilesystemAPIProvider,
                        IndexedDB: IndexedDBProvider,
                        WebSQL: WebSQLProvider,
                        // LocalStorage: LocalStorageProvider
                    };

                    var defaultConfig = {
                        size: 10 * 1024 * 1024,
                        name: "lls",
                    };

                    function selectImplementation(config) {
                        if (!config) config = {};
                        config = defaults(config, defaultConfig);

                        if (config.forceProvider) {
                            return providers[config.forceProvider].init(config);
                        }

                        return FilesystemAPIProvider.init(config)
                            .then(
                                function (impl) {
                                    return Q(impl);
                                },
                                function () {
                                    return IndexedDBProvider.init(config);
                                }
                            )
                            .then(
                                function (impl) {
                                    return Q(impl);
                                },
                                function () {
                                    return WebSQLProvider.init(config);
                                }
                            )
                            .then(
                                function (impl) {
                                    return Q(impl);
                                },
                                function () {
                                    console.error(
                                        "Unable to create any storage implementations.  Using LocalStorage"
                                    );
                                    return LocalStorageProvider.init(config);
                                }
                            );
                    }

                    function copy(obj) {
                        var result = {};
                        Object.keys(obj).forEach(function (key) {
                            result[key] = obj[key];
                        });

                        return result;
                    }

                    function handleDataMigration(
                        storageInstance,
                        config,
                        previousProviderType,
                        currentProivderType
                    ) {
                        var previousProviderType =
                            sessionMeta[config.name] &&
                            sessionMeta[config.name].lastStorageImpl;
                        if (config.migrate) {
                            if (
                                previousProviderType != currentProivderType &&
                                previousProviderType in providers
                            ) {
                                config = copy(config);
                                config.forceProvider = previousProviderType;
                                selectImplementation(config).then(
                                    function (prevImpl) {
                                        config.migrate(
                                            null,
                                            prevImpl,
                                            storageInstance,
                                            config
                                        );
                                    },
                                    function (e) {
                                        config.migrate(e);
                                    }
                                );
                            } else {
                                if (config.migrationComplete)
                                    config.migrationComplete();
                            }
                        }
                    }

                    /**
                     *
                     * LargeLocalStorage (or LLS) gives you a large capacity
                     * (up to several gig with permission from the user)
                     * key-value store in the browser.
                     *
                     * For storage, LLS uses the [FilesystemAPI](https://developer.mozilla.org/en-US/docs/WebGuide/API/File_System)
                     * when running in Chrome and Opera,
                     * [IndexedDB](https://developer.mozilla.org/en-US/docs/IndexedDB) in Firefox and IE
                     * and [WebSQL](http://www.w3.org/TR/webdatabase/) in Safari.
                     *
                     * When IndexedDB becomes available in Safari, LLS will
                     * update to take advantage of that storage implementation.
                     *
                     *
                     * Upon construction a LargeLocalStorage (LLS) object will be
                     * immediately returned but not necessarily immediately ready for use.
                     *
                     * A LLS object has an `initialized` property which is a promise
                     * that is resolved when the LLS object is ready for us.
                     *
                     * Usage of LLS would typically be:
                     * ```
                     * var storage = new LargeLocalStorage({size: 75*1024*1024});
                     * storage.initialized.then(function(grantedCapacity) {
                     *   // storage ready to be used.
                     * });
                     * ```
                     *
                     * The reason that LLS may not be immediately ready for
                     * use is that some browsers require confirmation from the
                     * user before a storage area may be created.  Also,
                     * the browser's native storage APIs are asynchronous.
                     *
                     * If an LLS instance is used before the storage
                     * area is ready then any
                     * calls to it will throw an exception with code: "NO_IMPLEMENTATION"
                     *
                     * This behavior is useful when you want the application
                     * to continue to function--regardless of whether or
                     * not the user has allowed it to store data--and would
                     * like to know when your storage calls fail at the point
                     * of those calls.
                     *
                     * LLS-contrib has utilities to queue storage calls until
                     * the implementation is ready.  If an implementation
                     * is never ready this could obviously lead to memory issues
                     * which is why it is not the default behavior.
                     *
                     * @example
                     *	var desiredCapacity = 50 * 1024 * 1024; // 50MB
                     *	var storage = new LargeLocalStorage({
                     *		// desired capacity, in bytes.
                     *		size: desiredCapacity,
                     *
                     * 		// optional name for your LLS database. Defaults to lls.
                     *		// This is the name given to the underlying
                     *		// IndexedDB or WebSQL DB or FSAPI Folder.
                     *		// LLS's with different names are independent.
                     *		name: 'myStorage'
                     *
                     *		// the following is an optional param
                     *		// that is useful for debugging.
                     *		// force LLS to use a specific storage implementation
                     *		// forceProvider: 'IndexedDB' or 'WebSQL' or 'FilesystemAPI'
                     *
                     *		// These parameters can be used to migrate data from one
                     *		// storage implementation to another
                     *		// migrate: LargeLocalStorage.copyOldData,
                     *		// migrationComplete: function(err) {
                     *		//   db is initialized and old data has been copied.
                     *		// }
                     *	});
                     *	storage.initialized.then(function(capacity) {
                     *		if (capacity != -1 && capacity != desiredCapacity) {
                     *			// the user didn't authorize your storage request
                     *			// so instead you have some limitation on your storage
                     *		}
                     *	})
                     *
                     * @class LargeLocalStorage
                     * @constructor
                     * @param {object} config {size: sizeInByes, [forceProvider: force a specific implementation]}
                     * @return {LargeLocalStorage}
                     */
                    function LargeLocalStorage(config) {
                        var deferred = Q.defer();
                        /**
                         * @property {promise} initialized
                         */
                        this.initialized = deferred.promise;

                        var piped = createPipeline([
                            "ready",
                            "ls",
                            "rm",
                            "clear",
                            "getContents",
                            "setContents",
                            "getAttachment",
                            "setAttachment",
                            "getAttachmentURL",
                            "getAllAttachments",
                            "getAllAttachmentURLs",
                            "revokeAttachmentURL",
                            "rmAttachment",
                            "getCapacity",
                            "initialized",
                        ]);

                        piped.pipe.addLast("lls", this);
                        piped.initialized = this.initialized;

                        var self = this;
                        selectImplementation(config)
                            .then(function (impl) {
                                self._impl = impl;
                                handleDataMigration(
                                    piped,
                                    config,
                                    self._impl.type
                                );
                                sessionMeta[config.name] =
                                    sessionMeta[config.name] || {};
                                sessionMeta[config.name].lastStorageImpl =
                                    impl.type;
                                deferred.resolve(piped);
                            })
                            .catch(function (e) {
                                // This should be impossible
                                console.log(e);
                                deferred.reject("No storage provider found");
                            });

                        return piped;
                    }

                    LargeLocalStorage.prototype = {
                        /**
                         * Whether or not LLS is ready to store data.
                         * The `initialized` property can be used to
                         * await initialization.
                         * @example
                         *	// may or may not be true
                         *	storage.ready();
                         *
                         *	storage.initialized.then(function() {
                         *		// always true
                         *		storage.ready();
                         *	})
                         * @method ready
                         */
                        ready: function () {
                            return this._impl != null;
                        },

                        /**
                         * List all attachments under a given key.
                         *
                         * List all documents if no key is provided.
                         *
                         * Returns a promise that is fulfilled with
                         * the listing.
                         *
                         * @example
                         *	storage.ls().then(function(docKeys) {
                         *		console.log(docKeys);
                         *	})
                         *
                         * @method ls
                         * @param {string} [docKey]
                         * @returns {promise} resolved with the listing, rejected if the listing fails.
                         */
                        ls: function (docKey) {
                            this._checkAvailability();
                            return this._impl.ls(docKey);
                        },

                        /**
                         * Remove the specified document and all
                         * of its attachments.
                         *
                         * Returns a promise that is fulfilled when the
                         * removal completes.
                         *
                         * If no docKey is specified, this throws an error.
                         *
                         * To remove all files in LargeLocalStorage call
                         * `lls.clear();`
                         *
                         * To remove all attachments that were written without
                         * a docKey, call `lls.rm('__emptydoc__');`
                         *
                         * rm works this way to ensure you don't lose
                         * data due to an accidently undefined variable.
                         *
                         * @example
                         * 	stoarge.rm('exampleDoc').then(function() {
                         *		alert('doc and all attachments were removed');
                         * 	})
                         *
                         * @method rm
                         * @param {string} docKey
                         * @returns {promise} resolved when removal completes, rejected if the removal fails.
                         */
                        rm: function (docKey) {
                            this._checkAvailability();
                            return this._impl.rm(docKey);
                        },

                        /**
                         * An explicit way to remove all documents and
                         * attachments from LargeLocalStorage.
                         *
                         * @example
                         *	storage.clear().then(function() {
                         *		alert('all data has been removed');
                         *	});
                         *
                         * @returns {promise} resolve when clear completes, rejected if clear fails.
                         */
                        clear: function () {
                            this._checkAvailability();
                            return this._impl.clear();
                        },

                        /**
                         * Get the contents of a document identified by `docKey`
                         * TODO: normalize all implementations to allow storage
                         * and retrieval of JS objects?
                         *
                         * @example
                         * 	storage.getContents('exampleDoc').then(function(contents) {
                         * 		alert(contents);
                         * 	});
                         *
                         * @method getContents
                         * @param {string} docKey
                         * @returns {promise} resolved with the contents when the get completes
                         */
                        getContents: function (docKey, options) {
                            this._checkAvailability();
                            return this._impl.getContents(docKey, options);
                        },

                        /**
                         * Set the contents identified by `docKey` to `data`.
                         * The document will be created if it does not exist.
                         *
                         * @example
                         * 	storage.setContents('exampleDoc', 'some data...').then(function() {
                         *		alert('doc written');
                         * 	});
                         *
                         * @method setContents
                         * @param {string} docKey
                         * @param {any} data
                         * @returns {promise} fulfilled when set completes
                         */
                        setContents: function (docKey, data, options) {
                            this._checkAvailability();
                            return this._impl.setContents(
                                docKey,
                                data,
                                options
                            );
                        },

                        /**
                         * Get the attachment identified by `docKey` and `attachKey`
                         *
                         * @example
                         * 	storage.getAttachment('exampleDoc', 'examplePic').then(function(attachment) {
                         *    	var url = URL.createObjectURL(attachment);
                         *    	var image = new Image(url);
                         *    	document.body.appendChild(image);
                         *    	URL.revokeObjectURL(url);
                         * 	})
                         *
                         * @method getAttachment
                         * @param {string} [docKey] Defaults to `__emptydoc__`
                         * @param {string} attachKey key of the attachment
                         * @returns {promise} fulfilled with the attachment or
                         * rejected if it could not be found.  code: 1
                         */
                        getAttachment: function (docKey, attachKey) {
                            if (!docKey) docKey = "__emptydoc__";
                            this._checkAvailability();
                            return this._impl.getAttachment(docKey, attachKey);
                        },

                        /**
                         * Set an attachment for a given document.  Identified
                         * by `docKey` and `attachKey`.
                         *
                         * @example
                         * 	storage.setAttachment('myDoc', 'myPic', blob).then(function() {
                         *    	alert('Attachment written');
                         * 	})
                         *
                         * @method setAttachment
                         * @param {string} [docKey] Defaults to `__emptydoc__`
                         * @param {string} attachKey key for the attachment
                         * @param {any} attachment data
                         * @returns {promise} resolved when the write completes.  Rejected
                         * if an error occurs.
                         */
                        setAttachment: function (docKey, attachKey, data) {
                            if (!docKey) docKey = "__emptydoc__";
                            this._checkAvailability();
                            return this._impl.setAttachment(
                                docKey,
                                attachKey,
                                data
                            );
                        },

                        /**
                         * Get the URL for a given attachment.
                         *
                         * @example
                         * 	storage.getAttachmentURL('myDoc', 'myPic').then(function(url) {
                         *   	var image = new Image();
                         *   	image.src = url;
                         *   	document.body.appendChild(image);
                         *   	storage.revokeAttachmentURL(url);
                         * 	})
                         *
                         * This is preferrable to getting the attachment and then getting the
                         * URL via `createObjectURL` (on some systems) as LLS can take advantage of
                         * lower level details to improve performance.
                         *
                         * @method getAttachmentURL
                         * @param {string} [docKey] Identifies the document.  Defaults to `__emptydoc__`
                         * @param {string} attachKey Identifies the attachment.
                         * @returns {promose} promise that is resolved with the attachment url.
                         */
                        getAttachmentURL: function (docKey, attachKey) {
                            if (!docKey) docKey = "__emptydoc__";
                            this._checkAvailability();
                            return this._impl.getAttachmentURL(
                                docKey,
                                attachKey
                            );
                        },

                        /**
                         * Gets all of the attachments for a document.
                         *
                         * @example
                         * 	storage.getAllAttachments('exampleDoc').then(function(attachEntries) {
                         * 		attachEntries.map(function(entry) {
                         *			var a = entry.data;
                         *			// do something with it...
                         * 			if (a.type.indexOf('image') == 0) {
                         *				// show image...
                         *			} else if (a.type.indexOf('audio') == 0) {
                         *				// play audio...
                         *			} else ...
                         *		})
                         * 	})
                         *
                         * @method getAllAttachments
                         * @param {string} [docKey] Identifies the document.  Defaults to `__emptydoc__`
                         * @returns {promise} Promise that is resolved with all of the attachments for
                         * the given document.
                         */
                        getAllAttachments: function (docKey) {
                            if (!docKey) docKey = "__emptydoc__";
                            this._checkAvailability();
                            return this._impl.getAllAttachments(docKey);
                        },

                        /**
                         * Gets all attachments URLs for a document.
                         *
                         * @example
                         * 	storage.getAllAttachmentURLs('exampleDoc').then(function(urlEntries) {
                         *		urlEntries.map(function(entry) {
                         *			var url = entry.url;
                         * 			// do something with the url...
                         * 		})
                         * 	})
                         *
                         * @method getAllAttachmentURLs
                         * @param {string} [docKey] Identifies the document.  Defaults to the `__emptydoc__` document.
                         * @returns {promise} Promise that is resolved with all of the attachment
                         * urls for the given doc.
                         */
                        getAllAttachmentURLs: function (docKey) {
                            if (!docKey) docKey = "__emptydoc__";
                            this._checkAvailability();
                            return this._impl.getAllAttachmentURLs(docKey);
                        },

                        /**
                         * Revoke the attachment URL as required by the underlying
                         * storage system.
                         *
                         * This is akin to `URL.revokeObjectURL(url)`
                         * URLs that come from `getAttachmentURL` or `getAllAttachmentURLs`
                         * should be revoked by LLS and not `URL.revokeObjectURL`
                         *
                         * @example
                         * 	storage.getAttachmentURL('doc', 'attach').then(function(url) {
                         *		// do something with the URL
                         *		storage.revokeAttachmentURL(url);
                         * 	})
                         *
                         * @method revokeAttachmentURL
                         * @param {string} url The URL as returned by `getAttachmentURL` or `getAttachmentURLs`
                         * @returns {void}
                         */
                        revokeAttachmentURL: function (url) {
                            this._checkAvailability();
                            return this._impl.revokeAttachmentURL(url);
                        },

                        /**
                         * Remove an attachment from a document.
                         *
                         * @example
                         * 	storage.rmAttachment('exampleDoc', 'someAttachment').then(function() {
                         * 		alert('exampleDoc/someAttachment removed');
                         * 	}).catch(function(e) {
                         *		alert('Attachment removal failed: ' + e);
                         * 	});
                         *
                         * @method rmAttachment
                         * @param {string} docKey
                         * @param {string} attachKey
                         * @returns {promise} Promise that is resolved once the remove completes
                         */
                        rmAttachment: function (docKey, attachKey) {
                            if (!docKey) docKey = "__emptydoc__";
                            this._checkAvailability();
                            return this._impl.rmAttachment(docKey, attachKey);
                        },

                        /**
                         * Returns the actual capacity of the storage or -1
                         * if it is unknown.  If the user denies your request for
                         * storage you'll get back some smaller amount of storage than what you
                         * actually requested.
                         *
                         * TODO: return an estimated capacity if actual capacity is unknown?
                         * -Firefox is 50MB until authorized to go above,
                         * -Chrome is some % of available disk space,
                         * -Safari unlimited as long as the user keeps authorizing size increases
                         * -Opera same as safari?
                         *
                         * @example
                         *	// the initialized property will call you back with the capacity
                         * 	storage.initialized.then(function(capacity) {
                         *		console.log('Authorized to store: ' + capacity + ' bytes');
                         * 	});
                         *	// or if you know your storage is already available
                         *	// you can call getCapacity directly
                         *	storage.getCapacity()
                         *
                         * @method getCapacity
                         * @returns {number} Capacity, in bytes, of the storage.  -1 if unknown.
                         */
                        getCapacity: function () {
                            this._checkAvailability();
                            if (this._impl.getCapacity)
                                return this._impl.getCapacity();
                            else return -1;
                        },

                        _checkAvailability: function () {
                            if (!this._impl) {
                                throw {
                                    msg: "No storage implementation is available yet.  The user most likely has not granted you app access to FileSystemAPI or IndexedDB",
                                    code: "NO_IMPLEMENTATION",
                                };
                            }
                        },
                    };

                    LargeLocalStorage.contrib = {};

                    function writeAttachments(docKey, attachments, storage) {
                        var promises = [];
                        attachments.forEach(function (attachment) {
                            promises.push(
                                storage.setAttachment(
                                    docKey,
                                    attachment.attachKey,
                                    attachment.data
                                )
                            );
                        });

                        return Q.all(promises);
                    }

                    function copyDocs(docKeys, oldStorage, newStorage) {
                        var promises = [];
                        docKeys.forEach(function (key) {
                            promises.push(
                                oldStorage
                                    .getContents(key)
                                    .then(function (contents) {
                                        return newStorage.setContents(
                                            key,
                                            contents
                                        );
                                    })
                            );
                        });

                        docKeys.forEach(function (key) {
                            promises.push(
                                oldStorage
                                    .getAllAttachments(key)
                                    .then(function (attachments) {
                                        return writeAttachments(
                                            key,
                                            attachments,
                                            newStorage
                                        );
                                    })
                            );
                        });

                        return Q.all(promises);
                    }

                    LargeLocalStorage.copyOldData = function (
                        err,
                        oldStorage,
                        newStorage,
                        config
                    ) {
                        if (err) {
                            throw err;
                        }

                        oldStorage
                            .ls()
                            .then(function (docKeys) {
                                return copyDocs(
                                    docKeys,
                                    oldStorage,
                                    newStorage
                                );
                            })
                            .then(
                                function () {
                                    if (config.migrationComplete)
                                        config.migrationComplete();
                                },
                                function (e) {
                                    config.migrationComplete(e);
                                }
                            );
                    };

                    LargeLocalStorage._sessionMeta = sessionMeta;

                    var availableProviders = [];
                    Object.keys(providers).forEach(function (
                        potentialProvider
                    ) {
                        if (providers[potentialProvider].isAvailable())
                            availableProviders.push(potentialProvider);
                    });

                    LargeLocalStorage.availableProviders = availableProviders;

                    return LargeLocalStorage;
                })(Q);

                return LargeLocalStorage;
            }

            if (typeof define === "function" && define.amd) {
                define(["Q"], definition);
            } else {
                glob.LargeLocalStorage = definition.call(glob, Q);
            }
        }.call(this, this));
        //#endregion Large Local Storage

        window.cdh_copy_paste = {
            message: {
                header: '<p style="">CDH Copy Paste! </p>',
                footer: '<br><p style="">Comments / bugs / feature requests? Send them to <a href="mailto:james.lingham@tealium.com">james.lingham@tealium.com</a></p>',
                namespace: "cdh_copy_paste",
                data: {
                    msg_queue: [],
                },
            },
            storage: new LargeLocalStorage({
                size: 125 * 1024 * 1024,
                name: "cdh_copy_paste",
            }),
            clipboard: {
                audiences: {},
                eventspecs: {},
                eventfeeds: {},
                attributes: {},
                enrichments: {},
                rules: {},
                connectors: {},
                actions: {},
            },
            util: {
                remove_empty: function (a) {
                    var b, t;
                    for (b in { ...a }) {
                        t = this.typeOf(a[b]);
                        if (t === "object") {
                            this.remove_empty(a[b]);
                            if (this.isEmptyObject(a[b])) {
                                try {
                                    delete a[b];
                                } catch (e) {
                                    a[b] = undefined;
                                }
                            }
                        } else if (
                            !(a[b] === 0 || a[b] === false
                                ? !0
                                : t === "array" && a[b].length === 0
                                ? !1
                                : !!a[b])
                        ) {
                            try {
                                delete a[b];
                            } catch (e) {
                                a[b] = undefined;
                            }
                        }
                    }
                    return a;
                },
                hasOwn: function (o, a) {
                    return (
                        o != null && Object.prototype.hasOwnProperty.call(o, a)
                    );
                },
                isEmptyObject: function (o, a) {
                    for (a in o) {
                        if (this.hasOwn(o, a)) {
                            return false;
                        }
                    }
                    return true;
                },
                typeOf: function (e) {
                    return {}.toString
                        .call(e)
                        .match(/\s([a-zA-Z]+)/)[1]
                        .toLowerCase();
                },
            },
            //taken from gApp Automator
            rulesArr2Obj: function rulesArr2Obj(arr) {
                // rules array to object, with logic:id pairs
                var rObj = {};
                for (var i = 0; i < arr.length; ++i)
                    if (arr[i] !== undefined)
                        rObj[arr[i].get("logic")] = arr[i].get("id");
                return rObj;
            },
            readClipboard: async function (name) {
                if ((await cdh_copy_paste.storage.getCapacity()) > -1) {
                    try {
                        return await cdh_copy_paste.storage.getContents(name);
                    } catch (e) {
                        console.log(e);
                        return "";
                    }
                } else {
                    return localStorage.getItem("cdh_clipboard");
                }
            },
            saveClipboard: async function (name, content) {
                var safe_content = btoa(
                    unescape(encodeURIComponent(JSON.stringify(content)))
                );
                if ((await cdh_copy_paste.storage.getCapacity()) > -1) {
                    var saved = cdh_copy_paste.storage
                        .setContents(name, safe_content)
                        .then((e) => {
                            return true;
                        });
                } else {
                    var saved = true;
                    try {
                        window.localStorage.setItem(name, safe_content);
                    } catch (e) {
                        saved = false;
                    }
                }
                if (saved) {
                    return true;
                } else {
                    alert("there was an error saving the clipboard");
                    return false;
                }
            },
            copyAttribute: function (i) {
                var att = gApp.inMemoryModels.quantifierCollection._byId[i];
                if (att && !this.clipboard.attributes[i]) {
                    this.clipboard.attributes[i] = att;

                    if (att.attributes.refers) {
                        // copy the tallys "fave" string too
                        this.copyAttribute(att.attributes.refers);
                    }
                    if (
                        att.attributes.name.indexOf("(favorite)") &&
                        att.attributes.type.displayName == "string"
                    ) {
                        var tally =
                            gApp.inMemoryModels.quantifierCollection.filter(
                                (e) => {
                                    return (
                                        e.attributes.refers == att.attributes.id
                                    );
                                }
                            );
                        if (tally.length) {
                            tally.forEach((e) => {
                                this.copyAttribute(e.id);
                            });
                        }
                    }
                    var enr = att.attributes.transformationIds;
                    if (enr.length) {
                        for (var x = 0; x < enr.length; x++) {
                            if (
                                typeof this.clipboard.enrichments[enr[x]] ==
                                "undefined"
                            ) {
                                this.copyEnrichment(enr[x]);
                            }
                        }
                    }

                    //Handle the attributes that depend on this attribute through enichments
                  gApp.inMemoryModels.transformationCollection.filter(
                      transformation =>
                          transformation.hasQuantifier(att) &&
                          att.get("transformationIds").indexOf(transformation.get("id")) < 0
                  ).map(obj => obj.get('actionData').propertyQuantifierId || obj.get('actionData').quantifierId)
                          }
            },
            copyEnrichment: function (i) {
                var enr = gApp.inMemoryModels.transformationCollection._byId[i];
                if (enr && !this.clipboard.enrichments[i]) {
                    this.clipboard.enrichments[i] = enr;
                }
                //var other_att = enr.get('actionData').quantifierId ? gApp.inMemoryModels.quantifierCollection.get(enr.get('actionData').quantifierId) : gApp.inMemoryModels.quantifierCollection.get(enr.get('actionData').propertyQuantifierId);
                var extra = [];
                for (var prop in enr.get("actionData")) {
                    if (
                        prop.match(/quantifierId|QuantifierId/) &&
                        !extra.includes(enr.get("actionData")[prop])
                    ) {
                        var id = enr.get("actionData")[prop];
                        extra.push(id.id || id);
                        break;
                    } else if (prop.match(/value|Value|entryToRemove|/)) {
                        var id = this.qualifiedId[enr.get("actionData")[prop]];
                        if (id && !extra.includes(id)) {
                            extra.push(id);
                            break;
                        }
                    }
                    if (prop == "snapShot") {
                        extra = extra.concat(enr.get("actionData")[prop]);
                    }
                }

                //timelines
                var action = enr.get("action");
                if (action && action.attributes.dateValue) {
                    extra.push(
                        action.attributes.dateValue.id ||
                            action.attributes.dateValue
                    );
                } else if (action && action.attributes.quantifier) {
                    extra.push(action.attributes.quantifier.id);
                }
                if (action && action.attributes.snapshot) {
                    extra = extra.concat(action.attributes.snapshot);
                }
                if (action && action.attributes.snapShot) {
                    extra = extra.concat(action.attributes.snapShot);
                }
                // others i havent grouped
                //todo group these
                //#region groupextras
                if (action) {
                    if (action.attributes.dateValue) {
                        extra.push(
                            action.attributes.dateValue.id ||
                                action.attributes.dateValue
                        );
                    }
                    if (action.attributes.quantifier) {
                        extra.push(action.attributes.quantifier.id);
                    }
                    if (action.attributes.quantifier) {
                        extra.push(action.attributes.quantifier.id);
                    }
                    if (action.attributes.utilityQuantifier) {
                        extra.push(action.attributes.utilityQuantifier.id);
                    }
                    if (
                        action.attributes.addValue &&
                        typeof action.attributes.addValue == "object"
                    ) {
                        extra.push(action.attributes.addValue.id);
                    }
                    if (
                        action.attributes.propertyListQuantifier1 &&
                        typeof action.attributes.propertyListQuantifier1 ==
                            "object"
                    ) {
                        extra.push(
                            action.attributes.propertyListQuantifier1.id
                        );
                    }

                    if (
                        action.attributes.numberArrayQuantifier &&
                        typeof action.attributes.numberArrayQuantifier ==
                            "object"
                    ) {
                        extra.push(action.attributes.numberArrayQuantifier.id);
                    }
                    if (
                        action.attributes.propertyListQuantifier2 &&
                        typeof action.attributes.propertyListQuantifier2 ==
                            "object"
                    ) {
                        extra.push(
                            action.attributes.propertyListQuantifier2.id
                        );
                    }
                    if (
                        action.attributes.sourceQuantifier &&
                        typeof action.attributes.sourceQuantifier == "object"
                    ) {
                        extra.push(action.attributes.sourceQuantifier.id);
                    }
                    if (
                        action.attributes.entryToRemove &&
                        typeof action.attributes.entryToRemove == "object"
                    ) {
                        extra.push(action.attributes.entryToRemove.id);
                    }
                    if (
                        action.attributes.operand2Quantifier &&
                        typeof action.attributes.operand2Quantifier == "object"
                    ) {
                        extra.push(action.attributes.operand2Quantifier.id);
                    }
                    if (
                        action.attributes.compareTo &&
                        typeof action.attributes.compareTo == "object"
                    ) {
                        extra.push(action.attributes.compareTo.id);
                    }
                    if (
                        action.attributes.date1Quantifier &&
                        typeof action.attributes.date1Quantifier == "object"
                    ) {
                        extra.push(action.attributes.date1Quantifier.id);
                    }
                    if (
                        action.attributes.date2Quantifier &&
                        typeof action.attributes.date2Quantifier == "object"
                    ) {
                        extra.push(action.attributes.date2Quantifier.id);
                    }

                    if (
                        action.attributes.propertyValue &&
                        typeof action.attributes.propertyValue == "object"
                    ) {
                        extra.push(action.attributes.propertyValue.id);
                    }

                    if (
                        action.attributes.operand1Quantifier &&
                        typeof action.attributes.operand1Quantifier == "object"
                    ) {
                        extra.push(action.attributes.operand1Quantifier.id);
                    }
                    if (
                        action.attributes.operand2Quantifier &&
                        typeof action.attributes.operand2Quantifier == "object"
                    ) {
                        extra.push(action.attributes.operand2Quantifier.id);
                    }

                    if (
                        action.attributes.propertySetQuantifier &&
                        typeof action.attributes.propertySetQuantifier ==
                            "object"
                    ) {
                        extra.push(action.attributes.propertySetQuantifier.id);
                    }
                    if (
                        action.attributes.metricSetQuantifier &&
                        typeof action.attributes.metricSetQuantifier == "object"
                    ) {
                        extra.push(action.attributes.metricSetQuantifier.id);
                    }
                    if (
                        action.attributes.metricSetDelimiter &&
                        typeof action.attributes.metricSetDelimiter == "object"
                    ) {
                        extra.push(action.attributes.metricSetDelimiter.id);
                    }

                    if (
                        action.attributes.metricListQuantifier1 &&
                        typeof action.attributes.metricListQuantifier1 ==
                            "object"
                    ) {
                        extra.push(action.attributes.metricListQuantifier1.id);
                    }

                    if (
                        action.attributes.metricListQuantifier2 &&
                        typeof action.attributes.metricListQuantifier2 ==
                            "object"
                    ) {
                        extra.push(action.attributes.metricListQuantifier2.id);
                    }
                    if (
                        action.attributes.eventQuantifier1 &&
                        typeof action.attributes.eventQuantifier1 == "object"
                    ) {
                        extra.push(action.attributes.eventQuantifier1.id);
                    }
                    if (
                        action.attributes.eventQuantifier2 &&
                        typeof action.attributes.eventQuantifier2 == "object"
                    ) {
                        extra.push(action.attributes.eventQuantifier2.id);
                    }
                    if (
                        action.attributes.incrementValue &&
                        typeof action.attributes.incrementValue == "object"
                    ) {
                        extra.push(action.attributes.incrementValue.id);
                    }
                    if (
                        action.attributes.metricValue &&
                        typeof action.attributes.metricValue == "object"
                    ) {
                        extra.push(action.attributes.metricValue.id);
                    }
                    if (
                        action.attributes.propertySetQuantifier1 &&
                        typeof action.attributes.propertySetQuantifier1 ==
                            "object"
                    ) {
                        extra.push(action.attributes.propertySetQuantifier1.id);
                    }
                    if (
                        action.attributes.propertySetQuantifier2 &&
                        typeof action.attributes.propertySetQuantifier2 ==
                            "object"
                    ) {
                        extra.push(action.attributes.propertySetQuantifier2.id);
                    }
                    if (
                        action.attributes.setValue &&
                        typeof action.attributes.setValue == "object"
                    ) {
                        extra.push(action.attributes.setValue.id);
                    }
                    if (
                        action.attributes.value &&
                        typeof action.attributes.value == "object"
                    ) {
                        extra.push(action.attributes.value.id);
                    }

                    //joins
                    if (
                        action.attributes.join &&
                        typeof action.attributes.join == "object"
                    ) {
                        var joins = action.attributes.join.models;
                        for (var i = 0; i < joins.length; i++) {
                            var join_id = joins[i].attributes.attribute;
                            var qual_id = cdh_copy_paste.qualifiedId[join_id];
                            if (qual_id) {
                                extra.push(qual_id);
                            }
                        }
                    }
                    // splits
                    if (
                        action.attributes.split &&
                        typeof action.attributes.split == "object"
                    ) {
                        var splits = action.attributes.split.models;
                        for (var i = 0; i < splits.length; i++) {
                            var split_id = splits[i].attributes.attribute;
                            var qual_id = cdh_copy_paste.qualifiedId[split_id];
                            if (qual_id) {
                                extra.push(qual_id);
                            }
                        }
                    }
                    if (
                        action.attributes.metricSetKey &&
                        typeof action.attributes.metricSetKey == "object"
                    ) {
                        extra.push(action.attributes.metricSetKey.id);
                    }
                    if (
                        action.attributes.capturedMetricSet &&
                        typeof action.attributes.capturedMetricSet == "object"
                    ) {
                        extra.push(action.attributes.capturedMetricSet.id);
                    }
                    if (
                        action.attributes.capturedMetric &&
                        typeof action.attributes.capturedMetric == "object"
                    ) {
                        extra.push(action.attributes.capturedMetric.id);
                    }
                    if (
                        action.attributes.sequenceQuantifier &&
                        typeof action.attributes.sequenceQuantifier == "object"
                    ) {
                        extra.push(action.attributes.sequenceQuantifier.id);
                    }
                }
                //#endregion

                for (var x = 0; x < extra.length; x++) {
                    if (!this.clipboard.attributes[extra[x]]) {
                        this.copyAttribute(extra[x]);
                    }
                }
                var rules = enr.attributes.rules;
                if (rules.length) {
                    for (var x = 0; x < rules.length; x++) {
                        if (
                            typeof this.clipboard.rules[rules[x]] == "undefined"
                        ) {
                            this.copyRule(rules[x]);
                        }
                    }
                }
            },
            copyRule: function (i) {
                var rule = gApp.inMemoryModels.ruleCollection._byId[i];
                if (typeof this.clipboard.rules[i] == "undefined") {
                    this.clipboard.rules[i] = rule;

                    var extra = [];
                    //operand.*?:".*?[^\\]"
                    //var logic_match = rule.attributes.logic.match(/operand.*?:".*?",/g);
                    var logic_match =
                        rule.attributes.logic.match(/operand.*?:".*?[^\\]"/g) ||
                        [];
                    for (var y = 0; y < logic_match.length; y++) {
                        var att =
                            logic_match[y].match(
                                /(metric_sets\.\d*?)\.(\w*?\.\d*?)"/
                            ) ||
                            logic_match[y].match(/(metric_sets\.\d*?)\./) ||
                            logic_match[y].match(/:"(.*?[^\\])"/) ||
                            [];
                        var id = this.qualifiedId[att[1]];
                        if (id && !extra.includes(id)) {
                            extra.push(id);
                        }
                        if (att[2]) {
                            var id2 = this.qualifiedId[att[2]];
                            if (id && !extra.includes(id2)) {
                                extra.push(id2);
                            }
                        }
                    }
                    for (var x = 0; x < extra.length; x++) {
                        if (!this.clipboard.attributes[extra[x]]) {
                            this.copyAttribute(extra[x]);
                        }
                    }
                }
            },
            copyAudience: function (i) {
                var audience = gApp.inMemoryModels.audienceCollection._byId[i];
                if (typeof this.clipboard.audiences[i] == "undefined") {
                    this.clipboard.audiences[i] = audience;

                    var extra = [];
                    var logic_match =
                        audience.attributes.logic.match(
                            /operand.*?:".*?[^\\]"/g
                        ) || [];
                    for (var y = 0; y < logic_match.length; y++) {
                        var att = logic_match[y].match(/:"(.*?[^\\])"/) || [];
                        var id = this.qualifiedId[att[1]];
                        if (id && !extra.includes(id)) {
                            extra.push(id);
                            // here
                        } else {
                            //var multi = att[1].match(/\d(\.)current_visit/) || [];
                            var multi =
                                att[1].match(/(\w+\.\d+)\.(\w+\.\d+)/) ||
                                att[1].match(/\w*?\.\d*?(\.)\w*?\./) ||
                                [];

                            if (multi[0]) {
                                splitpoint = att[1].replace(
                                    multi[0],
                                    multi[0].replace(
                                        `${multi[1]}.`,
                                        `${multi[1]}{{SPLIT}}`
                                    )
                                );
                                var multis = splitpoint.split("{{SPLIT}}");

                                for (var x = 0; x < multis.length; x++) {
                                    //att = logic_match[y].match(/:"(.*?[^\\])"/) || [];
                                    id = this.qualifiedId[multis[x]];
                                    if (id && !extra.includes(id)) {
                                        extra.push(id);
                                    }
                                }
                            }
                        }
                        // end
                    }
                    for (var x = 0; x < extra.length; x++) {
                        if (!this.clipboard.attributes[extra[x]]) {
                            this.copyAttribute(extra[x]);
                        }
                    }
                }
            },
            addAttribute: function (obj) {
                obj = obj.attributes || obj;

                if (obj.preloaded) {
                    return obj.id;
                }
                console.log("adding new attribute - " + obj.name);
                var qid = gApp.utils.quantifier.getNextUniqueQuantifierId();
                attribute = new gApp.models.Quantifier({
                    id: qid,
                    name: obj.name,
                    description: obj.description,
                    type: obj.type,
                    context: obj.context,
                    hidden: obj.hidden,
                    editable: obj.editable,
                    preloaded: obj.preloaded,
                    updatedBy: gApp.utils.user.getUserEmail(),
                    updatedDate: new Date().toISOString(),
                    createdBy: gApp.utils.user.getUserEmail(),
                    creationDate: new Date().toISOString(),
                    dataSourceType: obj.dataSourceType,
                    audienceDBEnabled:
                        gApp.inMemoryModels.settings.attributes
                            .audienceDBEnabled && obj.audienceDBEnabled,
                    eventDBEnabled:
                        gApp.inMemoryModels.settings.attributes
                            .eventDBEnabled && obj.eventDBEnabled,
                    isPersonalInfo: obj.isPersonalInfo,
                    labelIds: [cdh_copy_paste.labelid],
                });
                // adding new quantifier object to quantifier collections (add to UI)
                attribute.getFullyQualifiedId();
                if (obj.type.displayName == "badge") {
                    attribute.attributes.data = new gApp.models.Badge(obj.data);
                }
                if (obj.refers) {
                    var refer_replaced = this.replaces.attributes[obj.refers];
                    if (refer_replaced) {
                        attribute.attributes.refers = refer_replaced;
                    } else {
                        cdh_copy_paste.faves = cdh_copy_paste.faves || {};
                        cdh_copy_paste.faves[qid] = obj.refers;
                    }
                }
                if (obj.isPersonalInfo) {
                    attribute.attributes.isPersonalInfo = true;
                }
                if (obj.config) {
                    attribute.attributes.config = obj.config;
                }
                gApp.inMemoryModels.quantifierCollection.add(attribute);
                console.log("Attribute - " + qid + ":" + obj.name + " Added");
                return qid;
            },
            addEventFeed: function (obj) {
                obj = obj.attributes || obj;
                if (obj.preloaded) {
                    return obj.id;
                }
                var feed = { ...obj };
                // replace logic
                var logic = feed.logic;
                for (var new_att in cdh_copy_paste.replaces.attributes) {
                    //var old_id = gApp.inMemoryModels.quantifierCollection._byId[new_att].getFullyQualifiedId()
                    var old = cdh_copy_paste.clipboard.attributes[new_att]
                        .attributes
                        ? cdh_copy_paste.clipboard.attributes[new_att]
                              .attributes
                        : cdh_copy_paste.clipboard.attributes[new_att];
                    var old_id = old.fullyQualifiedId;

                    var new_id = old_id.replace(
                        new_att,
                        cdh_copy_paste.replaces.attributes[new_att]
                    );
                    var old_id = new RegExp(old_id, "g");
                    logic = logic.replace(old_id, new_id);
                }
                feed.logic = logic;
                //
                // check for clashes
                var replace_id = "";
                if (cdh_copy_paste.merge[obj.id]) {
                    var current_id =
                        cdh_copy_paste.clashes.feeds[`${feed.name}`];
                    var current_feed =
                        gApp.inMemoryModels.filteredStreamCollection.models.filter(
                            (e) => e.id == current_id
                        )[0];
                    replace_id = current_feed.id;
                }

                // get event specs
                var spec = Object.values(
                    cdh_copy_paste.clipboard.eventspecs
                ).filter((e) => e.attributes.linkedFilteredStreamId == obj.id);
                if (spec.length) {
                    var current_spec =
                        gApp.inMemoryModels.eventDefinitionCollection.models.filter(
                            (e) =>
                                e.attributes.linkedFilteredStreamId ==
                                current_id
                        )[0];

                    var has_spec = true;
                    spec = { ...spec[0] };
                    spec.id = gApp.utils.uuid();
                    spec.attributes.id = spec.id;
                    spec.attributes.eventAttributes = new Backbone.Collection(
                        spec.attributes.eventAttributes
                    );
                }

                if (replace_id) {
                    var new_feed = { ...current_feed };
                    var new_feed = new_feed.attributes;
                    new_feed.logic = logic;
                    new_feed.labelIds = new_feed.labelIds || [];
                    new_feed.labelIds.push(cdh_copy_paste.labelid);
                    new_feed.id = replace_id;

                    if (has_spec) {
                        spec.attributes.linkedFilteredStreamId = replace_id;
                        spec.attributes.labelIds.push(cdh_copy_paste.labelid);

                        var new_spec = new gApp.models.EventDefinition(
                            spec.attributes
                        );
                        gApp.inMemoryModels.eventDefinitionCollection.remove(
                            current_spec
                        );

                        gApp.inMemoryModels.eventDefinitionCollection.add(
                            new_spec
                        );
                    }
                    var copy = new gApp.models.FilteredStream(new_feed);
                    gApp.inMemoryModels.filteredStreamCollection.remove(
                        current_feed
                    );
                    gApp.inMemoryModels.filteredStreamCollection.add(copy);
                    return replace_id;
                } else {
                    var id = gApp.utils.uuid();
                    feed.id = id;
                    feed.labelIds = [cdh_copy_paste.labelid];
                    if (typeof cdh_copy_paste.merge[obj.id] !== "undefined") {
                        feed.name = feed.name + " Copy (cdh_copy_paste)";
                    }
                    var eventFeedToAdd = new gApp.models.FilteredStream(feed);
                    //specs
                    if (has_spec) {
                        if (
                            typeof cdh_copy_paste.merge[obj.id] !== "undefined"
                        ) {
                            spec.name = spec.name + " Copy (cdh_copy_paste)";
                        }
                        spec.attributes.labelIds = [cdh_copy_paste.labelid];
                        spec.attributes.linkedFilteredStreamId = feed.id;
                        var new_spec = new gApp.models.EventDefinition(
                            spec.attributes
                        );
                        gApp.inMemoryModels.eventDefinitionCollection.add(
                            new_spec
                        );
                    }
                    //
                    gApp.inMemoryModels.filteredStreamCollection.add(
                        eventFeedToAdd
                    );
                    console.log(
                        "Event Feed - " + id + ":" + obj.name + " Added"
                    );

                    return id;
                }
            },
            copyEventFeed: function (i) {
                //todo
                var feed =
                    gApp.inMemoryModels.filteredStreamCollection._byId[i];
                if (typeof this.clipboard.eventfeeds[i] == "undefined") {
                    this.clipboard.eventfeeds[i] = feed;

                    var extra = [];
                    var logic_match =
                        feed.attributes.logic.match(/operand.*?:".*?[^\\]"/g) ||
                        [];
                    for (var y = 0; y < logic_match.length; y++) {
                        var att = logic_match[y].match(/:"(.*?[^\\])"/) || [];
                        var id = this.qualifiedId[att[1]];
                        if (id && !extra.includes(id)) {
                            extra.push(id);
                        }
                    }

                    //get event spec
                    var spec =
                        gApp.inMemoryModels.eventDefinitionCollection.models.filter(
                            (e) => e.attributes.linkedFilteredStreamId == i
                        );
                    if (spec.length) {
                        this.clipboard.eventspecs[spec[0].id] = { ...spec[0] };
                        spec[0].attributes.eventAttributes.models.forEach(
                            (e) => {
                                var spec_var =
                                    cdh_copy_paste.qualifiedId[
                                        e.attributes.attribute
                                    ];
                                spec_var ? extra.push(spec_var) : "";
                            }
                        );
                    }

                    for (var x = 0; x < extra.length; x++) {
                        if (!this.clipboard.attributes[extra[x]]) {
                            this.copyAttribute(extra[x]);
                        }
                    }
                }
            },
            copyConnector: function (id) {
                this.clipboard.connectors[id] = JSON.parse(
                    JSON.stringify({
                        ..._store.connectors.items[
                            _store.connectors.itemsMap.get(id)
                        ],
                    })
                );
            },
            copyAction: function (id) {
                var action = JSON.parse(
                    JSON.stringify({
                        ..._store.actions.items[
                            _store.actions.itemsMap.get(id)
                        ],
                    })
                );
                this.clipboard.actions[id] = action;
                this.clipboard.connectors[action.connectorId]
                    ? ""
                    : this.copyConnector(action.connectorId);

                var config = JSON.stringify(
                    this.clipboard.actions[id].configurations
                );
                var possible_atts = [
                    ...config.matchAll(/\{.*?"value":"(.*?[^\\])".*?\}/g),
                ]
                    .filter((e) => e[0].indexOf('"custom":true') == -1)
                    .map((e) => e[1]);
                //var possible_atts = [...config.matchAll(/\{.*?"value":"(.*?[^\\])".*?\}/g)].filter(e=>e[0].indexOf('\"custom\":false') >-1).map(e=>e[1]);
                possible_atts.forEach((e) => {
                    var id = this.qualifiedId[e];
                    if (
                        id &&
                        gApp.inMemoryModels.quantifierCollection._byId[id]
                    ) {
                        this.copyAttribute(id);
                    }
                });
                if (action.source.type == "VISITOR") {
                    this.copyAudience(action.source.id);
                } else if (action.source.type == "EVENT") {
                    this.copyEventFeed(action.source.id);
                }
            },
            addConnector: function (obj) {
                var copy = { ...obj };
                var replace_id = "";
                if (cdh_copy_paste.merge[obj.id]) {
                    var current_id =
                        cdh_copy_paste.clashes.conns[`${obj.type}.${obj.name}`];
                    var current_conn = _store.connectors.visibleItems.filter(
                        (e) => e.id == current_id
                    )[0];
                    replace_id = current_conn.id;
                }
                if (replace_id) {
                    copy.id = current_conn.id;
                    _store.connectors.remove(current_conn);
                    var conn = new _store.connectors.Item(copy);
                    _store.connectors.add(conn);
                    return replace_id;
                } else {
                    delete copy.id;
                    if (typeof cdh_copy_paste.merge[obj.id] !== "undefined") {
                        copy.name = copy.name + " Copy (cdh_copy_paste)";
                    }
                    var conn = new _store.connectors.Item(copy);
                    _store.connectors.add(conn);

                    return conn.id;
                }
            },
            addAction: function (obj) {
                //temp merge logic
                var copy = { ...obj };
                var replace_id = "";

                if (cdh_copy_paste.merge[obj.id]) {
                    // get 'unique' name
                    //var conn = _store.connectors.visibleItems.filter(c=>c.id==cdh_copy_paste.replaces.connectors[obj.connectorId]);
                    if (cdh_copy_paste.merge[obj.connectorId]) {
                        var conn = _store.connectors.visibleItems.filter(
                            (c) =>
                                c.id ==
                                cdh_copy_paste.replaces.connectors[
                                    obj.connectorId
                                ]
                        );
                    } else {
                        var conn = [
                            cdh_copy_paste.clipboard.connectors[
                                obj.connectorId
                            ],
                        ];
                    }
                    var conn_name = `${conn[0].type}.${conn[0].name}`;

                    if (obj.source.type == "VISITOR") {
                        var source_id =
                            cdh_copy_paste.replaces.audiences[obj.source.id] ||
                            e.source.id;
                        var source = _store.audiences.visibleItems.filter(
                            (c) => c.id == source_id
                        );
                        var source_name = `audience.${source[0].name}`;
                    } else if (obj.source.type == "EVENT") {
                        var source_id =
                            cdh_copy_paste.replaces.eventfeeds[obj.source.id] ||
                            e.source.id;
                        var source = _store.eventFeeds.items.filter(
                            (c) => c.id == source_id
                        );
                        var source_name = `event.${source[0].name}`;
                    }

                    var current_id =
                        cdh_copy_paste.clashes.actions[
                            `${conn_name}.${source_name}.${obj.type}.${obj.name}.${obj.trigger}`
                        ];
                    var current_act = _store.actions.visibleItems.filter(
                        (e) => e.id == current_id
                    )[0];
                    replace_id = current_act.id;
                }

                if (copy.source.type == "VISITOR") {
                    copy.source.id = this.replaces.audiences[copy.source.id];
                } else if (copy.source.type == "EVENT") {
                    copy.source.id = this.replaces.eventfeeds[copy.source.id];
                }
                //var action = new _store.actions.Item(copy);

                // replace attributes

                var config = JSON.stringify(copy.configurations);
                var possible_atts = [
                    ...config.matchAll(/\{.*?"value":"(.*?[^\\])".*?\}/g),
                ]
                    .filter((e) => e[0].indexOf('"custom":false') > -1)
                    .map((e) => e[1]);
                possible_atts.forEach((e) => {
                    //var id = this.qualifiedId[e];
                    var parts = e.split(".");
                    var id =
                        parts.length > 1 ? parts[parts.length - 1] : undefined;

                    if (id && isNaN(e) && this.replaces.attributes[id]) {
                        config = config.replace(
                            e,
                            e.replace(id, this.replaces.attributes[id])
                        );
                    }
                });

                if (replace_id) {
                    copy.id = current_act.id;

                    copy.updatedBy = gApp.utils.user.getUserEmail();
                    copy.updatedDate = new Date().toISOString();
                    copy.labelIds = [cdh_copy_paste.labelid];
                    copy.ui.isNew = true;
                    if (cdh_copy_paste.merge[obj.connectorId]) {
                        copy.connectorId =
                            this.replaces.connectors[copy.connectorId];
                    } else {
                        copy.connectorId = current_act.connectorId;
                    }

                    _store.actions.remove(current_act);
                    var action = new _store.actions.Item(copy);
                    _store.actions.add(action);

                    return replace_id;
                } else {
                    //
                    //var copy = {...obj};
                    delete copy.id;
                    delete copy.session;

                    if (typeof cdh_copy_paste.merge[obj.id] !== "undefined") {
                        copy.name = copy.name + " Copy (cdh_copy_paste)";
                    }
                    copy.ui.isNew = true;
                    copy.connectorId =
                        this.replaces.connectors[copy.connectorId];
                    copy.createdBy = gApp.utils.user.getUserEmail();
                    copy.updatedBy = gApp.utils.user.getUserEmail();
                    copy.creationDate = new Date().toISOString();
                    copy.updatedDate = new Date().toISOString();
                    copy.labelIds = [cdh_copy_paste.labelid];
                    //
                    copy.configurations = JSON.parse(config);
                    var action = new _store.actions.Item(copy);
                    _store.actions.add(action);

                    return action.id;
                }
            },
            addRule: function (obj) {
                obj = obj.attributes || obj;
                var rObj = this.rulesArr2Obj(
                    gApp.inMemoryModels.ruleCollection.models
                );
                var new_logic = obj.logic;
                var found_atts = [
                    ...new_logic.matchAll(/"operand\d":"(.*?)"/g),
                ];
                if (found_atts) {
                    for (var i = 0; i < found_atts.length; i++) {
                        var qual_id = found_atts[i][1];
                        if (qual_id.indexOf("current_visit.last_event") == -1) {
                            // keep ES vars the same
                            var split_qual = qual_id.split(".");
                            //if (qual_id.match(/metric_sets\.(\d*?)\./)){debugger}
                            var tally_split =
                                qual_id.match(
                                    /metric_sets\.(\d*?)\.\w*?\.(\d*)/
                                ) ||
                                qual_id.match(/metric_sets\.(\d*?)\./) ||
                                [];
                            var id =
                                tally_split[1] ||
                                split_qual[split_qual.length - 1];
                            var new_id = this.replaces.attributes[id];
                            new_qual_id = "";
                            //debugger
                            if (new_id) {
                                new_qual_id = qual_id.replace(id, new_id);
                            }
                            if (tally_split[2]) {
                                var id2 = tally_split[2];
                                var new_id2 = this.replaces.attributes[id2];
                                if (new_id2) {
                                    new_qual_id = new_qual_id || qual_id;
                                    new_qual_id = new_qual_id.replace(
                                        id2,
                                        new_id2
                                    );
                                }
                            }
                            if (new_qual_id) {
                                new_logic = new_logic.replace(
                                    new RegExp(qual_id, "g"),
                                    new_qual_id
                                );
                            }
                        } else {
                            var omni_att = qual_id.match(
                                /\.omnichannel\.(.*?\.)/
                            );
                            if (omni_att) {
                                new_logic = new_logic.replace(
                                    qual_id,
                                    qual_id.replace(
                                        omni_att[0],
                                        omni_att[0].replace(omni_att[1], "")
                                    )
                                );
                            }
                        }
                    }
                }

                //
                if (rObj[new_logic] === undefined) {
                    var rule_id = gApp.utils.rule.getNextUniqueRuleId();
                    var rule = new gApp.models.Rule({
                        id: rule_id,
                        name: obj.name,
                        labelIds: [cdh_copy_paste.labelid],
                        editable: true,
                        hidden: false,
                        preloaded: false,
                    });
                    var r = gApp.inMemoryModels.ruleCollection.add(rule);
                    gApp.inMemoryModels.ruleCollection
                        .get(r.get("id"))
                        .set("logic", new_logic);
                    console.log("Rule " + rule_id + " added");
                    return rule_id;
                } else {
                    console.log("Rule already existed");
                    return rObj[new_logic];
                }
            },
            addAudience: async function (obj) {
                obj = obj.attributes || obj;

                // correct the logic
                var logic = obj.logic;
                for (var new_att in cdh_copy_paste.replaces.attributes) {
                    //var old_id = gApp.inMemoryModels.quantifierCollection._byId[new_att].getFullyQualifiedId()
                    var old = cdh_copy_paste.clipboard.attributes[new_att]
                        .attributes
                        ? cdh_copy_paste.clipboard.attributes[new_att]
                              .attributes
                        : cdh_copy_paste.clipboard.attributes[new_att];
                    var old_id = old.fullyQualifiedId;

                    var new_id = old_id.replace(
                        new_att,
                        cdh_copy_paste.replaces.attributes[new_att]
                    );
                    var old_id = new RegExp(old_id, "g");
                    logic = logic.replace(old_id, new_id);
                }
                //
                // check for clashes
                var replace_id = "";
                if (cdh_copy_paste.merge[obj.id]) {
                    // this should be overwritten
                    var current_id =
                        cdh_copy_paste.clashes.audiences[`${obj.name}`];
                    var current_aud =
                        gApp.inMemoryModels.audienceCollection.models.filter(
                            (e) => e.id == current_id
                        )[0];
                    // delete existing enrichments
                    replace_id = current_aud.id;
                }

                if (replace_id) {
                    var copy = { ...current_aud };
                    copy = copy.attributes;
                    copy.logic = logic;
                    copy.labelIds = copy.labelIds || [];
                    copy.labelIds.push(cdh_copy_paste.labelid);
                    copy.id = replace_id;

                    //_store.audiences.remove(current_aud);
                    var audience = new gApp.models.Audience(copy);
                    gApp.inMemoryModels.audienceCollection.remove(current_aud);
                    gApp.inMemoryModels.audienceCollection.add(audience);
                    //_store.audiences.add(new _store.audiences.Item(copy));
                    return replace_id;
                    // edit the current audience
                } else {
                    // add the new audience here
                    var id = await gApp.service.getNextUniqueStreamId();
                    var audience = new gApp.models.Audience({
                        id: id,
                        name: obj.name,
                        labelIds: [cdh_copy_paste.labelid],
                        visitorRetentionDays: obj.visitorRetentionDays || 0,
                        logic: logic,
                        perspective: obj.perspective,
                    });
                    //attribute.getFullyQualifiedId();
                    if (typeof cdh_copy_paste.merge[obj.id] !== "undefined") {
                        audience.name =
                            audience.name + " Copy (cdh_copy_paste)";
                    }
                    gApp.inMemoryModels.audienceCollection.add(audience);
                    console.log("Audience - " + id + ":" + obj.name + " Added");
                    return id;
                }
            },
            addEnrichment: function (obj) {
                obj = obj.attributes || obj;
                if (obj.preloaded) {
                    return obj.id;
                }
                // taken from gapp automator
                try {
                    var transActionName =
                        gApp.inMemoryModels.transformationTypeCollection
                            .get(obj.type.id)
                            .get("actionName");
                    // build transformation object
                    var tObj = {
                        id: gApp.utils.transformation.getNextUniqueTransformationId(),
                        name: obj.name,
                        description: obj.description,
                        trigger: new gApp.models.Trigger(
                            gApp.inMemoryModels.triggerCollection.get(
                                obj.trigger.id
                            ).attributes
                        ),
                        //"type": new gApp.models.TransformationType(obj.type.id),
                        type: new gApp.models.TransformationType(
                            gApp.inMemoryModels.transformationTypeCollection.get(
                                obj.type.id
                            ).attributes
                        ),
                        hidden: obj.hidden,
                        editable: obj.editable,
                        preloaded: obj.preloaded,
                        rules: [],
                        orderIndex:
                            gApp.utils.transformation.nextTransformationOrderIndex(),
                    };
                    // add transformation, as per transformation action name

                    for (var i = 0; i < obj.rules.length; i++) {
                        var new_rule = this.replaces.rules[obj.rules[i]];
                        if (new_rule) {
                            tObj.rules.push(new_rule);
                        }
                    }
                    //switch (obj.name) {
                    switch (
                        obj.type.displayName ||
                        obj.type.attributes.displayName
                    ) {
                        //#region Shared
                        case "Reset": // Array of Bools / Numbers / Strings
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        //#endregion
                        //#region Array of Booleans

                        case "Add a Boolean":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.addValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                addValue:
                                    ea ||
                                    (typeof obj.action.addValue == "string"
                                        ? obj.action.addValue
                                        : ""),
                            });
                            break;

                        case "Add an Array of Booleans":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.sourceQuantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                sourceQuantifier: ea,
                            });
                            break;
                        //#endregion
                        //#region Arrary of Numbers
                        case "Add a Number":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.addValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                addValue:
                                    ea ||
                                    (typeof obj.action.addValue == "string"
                                        ? obj.action.addValue
                                        : ""),
                            });
                            break;

                        case "Add an Array of Numbers":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.sourceQuantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                sourceQuantifier: ea,
                            });
                            break;

                        case "Set Array of Numbers to be the Difference of Two Arrays":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.metricListQuantifier1.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea1 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            var e_old_id2 = obj.action.metricListQuantifier2.id;
                            var e_new_id2 = this.replaces.attributes[e_old_id2];
                            var ea2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id2
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricListQuantifier1: ea1,
                                metricListQuantifier2: ea2,
                            });
                            break;
                        //#endregion
                        //#region Array of Strings
                        case "Add To Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.addValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ] || obj.action.addValue;

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                addValue: ea,
                            });
                            break;
                        case "Add a String":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.addValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                addValue:
                                    ea ||
                                    (typeof obj.action.addValue == "string"
                                        ? obj.action.addValue
                                        : ""),
                            });
                            break;
                        case "Add an Array of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.sourceQuantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                sourceQuantifier: ea,
                            });
                            tObj.actionData = {
                                quantifierId: va.id,
                                sourceQuantifierId: ea.id,
                            };
                            break;
                        case "Difference Between Two Arrays":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id =
                                obj.action.propertyListQuantifier1.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            var e_old_id2 =
                                obj.action.propertyListQuantifier2.id;
                            var e_new_id2 = this.replaces.attributes[e_old_id2];
                            var ea2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id2
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                propertyListQuantifier1: ea,
                                propertyListQuantifier2: ea2,
                            });
                            tObj.actionData = {
                                quantifierId: va.id,
                                propertyListQuantifierId1: ea.id,
                                propertyListQuantifierId2: ea2.id,
                            };

                            break;
                        case "Lowercase":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        case "Remove a string from the array":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.entryToRemove.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                entryToRemove:
                                    ea ||
                                    (typeof obj.action.entryToRemove == "string"
                                        ? obj.action.entryToRemove
                                        : ""),
                                instance: obj.action.instance,
                            });
                            break;
                        case "Set to Set of Strings":
                        case "Add a Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.sourceQuantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                sourceQuantifier: ea,
                            });
                            break;
                        //#endregion
                        //#region Badges
                        case "assign badge":
                        case "remove badge":
                            var v_old_id = obj.action.badgeQuantifier.id;
                            var v_new_id =
                                cdh_copy_paste.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];
                            tObj.action = new gApp.models[transActionName]({
                                badgeQuantifier: va,
                            });
                            tObj.actionData = {
                                quantifierId: v_new_id,
                            };
                            break;
                        case "assign badge from another badge":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id =
                                cdh_copy_paste.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var old_value_id = obj.action.value.id;
                            var new_value_id =
                                cdh_copy_paste.replaces.attributes[
                                    old_value_id
                                ];
                            var value =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    new_value_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                value: value,
                            });
                            break;
                        //#endregion
                        //#region Booleans
                        case "Set Boolean":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id =
                                cdh_copy_paste.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var value = obj.action.value;

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                value: value,
                            });
                            break;
                        //#endregion
                        //#region Dates
                        case "Set Date":
                        case "Convert from Date Format":
                            if (obj.action.dateValue) {
                                var v_old_id = obj.action.dateValue.id;
                                var v_new_id =
                                    this.replaces.attributes[v_old_id];
                                var va =
                                    gApp.inMemoryModels.quantifierCollection
                                        ._byId[v_new_id];
                            }
                            var e_old_id = obj.action.quantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: ea,
                            });
                            // set date format, if enrichment attribute ANY and date format has been passed
                            //todo
                            if (obj.action.dateValue) {
                                tObj.action.attributes.dateValue = va;
                            }
                            if (obj.action.dateFormat) {
                                tObj.action.attributes.dateFormat =
                                    obj.action.dateFormat;
                            }
                            break;
                        case "Capture Current Timestamp":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            tObj.actionData = {
                                quantifier: va,
                            };

                            break;
                        case "Remove Date":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        //#endregion
                        //#region Funnels
                        case "Update Funnel":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                stepId: obj.action.stepId,
                                stepName: obj.action.stepName,
                                stepRequired: obj.action.stepRequired,
                            });

                            break;
                        //#endregion
                        //#region Numbers
                        case "Set Number":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.metricValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricValue:
                                    ea ||
                                    (typeof obj.action.metricValue == "string"
                                        ? obj.action.metricValue
                                        : ""),
                            });
                            break;
                        case "Set To Tally&#x27;s Rolling Max Based On A Timeline":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.capturedMetricSet.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            var sq_old_id = obj.action.sequenceQuantifier.id;
                            var sq_new_id = this.replaces.attributes[sq_old_id];
                            var sq =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sq_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricSetKey: obj.metricSetKey,
                                capturedMetricSet: ea,
                                sequenceQuantifier: sq,
                            });
                            break;
                        case "Set Difference Between Two Dates":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var d1_old_id = obj.action.date1Quantifier.id;
                            var d1_new_id = this.replaces.attributes[d1_old_id];
                            var d1 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    d1_new_id
                                ];

                            var d2_old_id = obj.action.date2Quantifier.id;
                            var d2_new_id = this.replaces.attributes[d2_old_id];
                            var d2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    d2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                date1Quantifier: d1,
                                date2Quantifier: d2,
                                dateUnit: obj.action.dateUnit,
                            });
                            break;
                        case "Increment or Decrement Number":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.incrementValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                incrementValue:
                                    ea ||
                                    (typeof obj.action.incrementValue ==
                                    "string"
                                        ? obj.action.incrementValue
                                        : ""),
                            });

                            break;
                        case "Set Ratio":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o1_old_id = obj.action.operand1Quantifier.id;
                            var o1_new_id = this.replaces.attributes[o1_old_id];
                            var o1 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o1_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                operand1Quantifier: o1,
                                operand2Quantifier: o2,
                            });

                            break;
                        case "Set Product":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o1_old_id = obj.action.operand1Quantifier.id;
                            var o1_new_id = this.replaces.attributes[o1_old_id];
                            var o1 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o1_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                operand1Quantifier: o1,
                                operand2Quantifier: o2,
                            });
                            break;
                        case "Set Difference":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o1_old_id = obj.action.operand1Quantifier.id;
                            var o1_new_id = this.replaces.attributes[o1_old_id];
                            var o1 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o1_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                operand1Quantifier: o1,
                                operand2Quantifier: o2,
                            });
                            break;
                        case "Set Sum":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o1_old_id = obj.action.operand1Quantifier.id;
                            var o1_new_id = this.replaces.attributes[o1_old_id];
                            var o1 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o1_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                operand1Quantifier: o1,
                                operand2Quantifier: o2,
                            });
                            break;
                        case "Set Rolling Average Based On Timeline":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.sequenceQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            var ca_old_id = obj.action.capturedMetric.id;
                            var ca_new_id = this.replaces.attributes[ca_old_id];
                            var ca =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    ca_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                capturedMetric: ca,
                                quantifier: va,
                                sequenceQuantifier: sa,
                            });
                            break;
                        case "Set Number To The Number Of Entries In Timeline":
                            //
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.sequenceQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                dateRange: obj.action.dateRange,
                                sequenceQuantifier: sa,
                            });
                            if (obj.action.millisecondOffset) {
                                tObj.action.attributes.millisecondOffset =
                                    obj.action.millisecondOffset;
                            }
                            break;
                        case "Set Number To Tally Value":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.metricSetQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricSetKey: obj.action.metricSetKey,
                                metricSetQuantifier: sa,
                            });
                            break;
                        case "Set Number To The Count Of Items In Tally":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.metricSetQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricSetQuantifier: sa,
                            });
                            break;
                        case "Set Number To The Count Of Items In Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.propertySetQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                propertySetQuantifier: sa,
                            });
                            break;
                        case "Set Rolling Sum Based On Timeline":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.sequenceQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            var ca_old_id = obj.action.capturedMetric.id;
                            var ca_new_id = this.replaces.attributes[ca_old_id];
                            var ca =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    ca_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                capturedMetric: ca,
                                quantifier: va,
                                sequenceQuantifier: sa,
                            });
                            break;
                        case "Set To Number Based On Average of An Array of Numbers":
                        //break;
                        case "Set To Number Based On Max of An Array of Numbers":
                        //break;
                        case "Set To Number Based On Min of An Array of Numbers":
                            // not in ui
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var na_old_id = obj.action.numberArrayQuantifier.id;
                            var na_new_id = this.replaces.attributes[na_old_id];
                            var na =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    na_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                numberArrayQuantifier: na,
                            });
                            break;
                        case "Set Number to Change In Number":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                operand2Quantifier: o2,
                            });
                            break;
                        case "Set Number to Change In Date":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                dateUnit: obj.action.dateUnit,
                                operand2Quantifier: o2,
                            });
                            break;
                        case "Set to the number of items in the array":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var sa_old_id = obj.action.sourceQuantifier.id;
                            var sa_new_id = this.replaces.attributes[sa_old_id];
                            var sa =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    sa_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                sourceQuantifier: sa,
                            });
                            break;
                        //#endregion
                        //#region Timelines
                        case "Set Expiration For Timeline Events":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id =
                                cdh_copy_paste.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];
                            var days = obj.action.daysToLive;
                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                daysToLive: days,
                            });

                            break;
                        case "Update Timeline":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id =
                                cdh_copy_paste.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];
                            var dv = obj.action.dateValue;
                            var snap = obj.action.snapShot.map((e) => {
                                return cdh_copy_paste.replaces.attributes[e];
                            });

                            if (parseInt(dv)) {
                                dv = cdh_copy_paste.replaces.attributes[dv];
                            }
                            var df = obj.action.dateFormat;
                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                dateFormat: df,
                                dateValue: dv,
                                snapShot: snap,
                            });
                            break;

                        //#endregion
                        //#region Set of Strings
                        case "Difference Between Two Sets of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.propertySetQuantifier1.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            var e_old_id2 =
                                obj.action.propertySetQuantifier2.id;
                            var e_new_id2 = this.replaces.attributes[e_old_id2];
                            var ea2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id2
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                propertySetQuantifier1: ea,
                                propertySetQuantifier2: ea2,
                            });
                            break;
                        case "Lowercase Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                propertySetQuantifierId1: v_new_id,
                            });
                            break;
                        case "Store Array as Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.setValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                setValue:
                                    ea ||
                                    (typeof obj.action.setValue == "string"
                                        ? obj.action.setValue
                                        : ""),
                            });
                            break;
                        case "Update Set of Strings By Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.addValue.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                addValue:
                                    ea ||
                                    (typeof obj.action.addValue == "string"
                                        ? obj.action.addValue
                                        : ""),
                            });
                            break;
                        case "Remove Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        case "Set to Top Tally Items":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.operand2Quantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                count: obj.action.count,
                                operand2Quantifier:
                                    ea ||
                                    (typeof obj.action.operand2Quantifier ==
                                    "string"
                                        ? obj.action.operand2Quantifier
                                        : ""),
                            });
                            break;
                        case "Set to Tally Items Above Target Value":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.operand2Quantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            var e_old_id2 = obj.action.compareTo.id;
                            var e_new_id2 = this.replaces.attributes[e_old_id2];
                            var ea2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id2
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                compareTo:
                                    ea2 ||
                                    (typeof obj.action.compareTo == "string"
                                        ? obj.action.compareTo
                                        : ""),
                                comparison: obj.action.comparison,
                                operand2Quantifier:
                                    ea ||
                                    (typeof obj.action.operand2Quantifier ==
                                    "string"
                                        ? obj.action.operand2Quantifier
                                        : ""),
                            });
                            break;
                        case "Remove Entry from Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id = obj.action.entryToRemove.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                entryToRemove:
                                    ea ||
                                    (typeof obj.action.entryToRemove == "string"
                                        ? obj.action.entryToRemove
                                        : ""),
                            });
                            break;

                        //#endregion
                        //#region Strings
                        case "Set String":
                            var v_old_id = obj.action.propertyQuantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var e_old_id =
                                typeof obj.action.propertyValue == "object"
                                    ? obj.action.propertyValue.id
                                    : undefined;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ] || obj.action.propertyValue;

                            tObj.action = new gApp.models[transActionName]({
                                propertyQuantifier: va,
                                propertyValue: ea,
                            });
                            /* not needed?
              tObj.actionData = {
                propertyQuantifierId: va,
                propertyValue: ea.getFullyQualifiedId(),
              };*/
                            break;
                        case "Split String":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var split_list = obj.action.split;
                            var splits = new Backbone.Collection();

                            for (var s = 0; s < split_list.length; s++) {
                                var entry = split_list[s];
                                var data = {};
                                var split_id =
                                    entry.attribute.match(/^(\w*?\.(\d*))$/);
                                split_id = split_id
                                    ? entry.attribute.replace(
                                          split_id[2],
                                          cdh_copy_paste.replaces.attributes[
                                              split_id[2]
                                          ]
                                      )
                                    : entry.attribute;
                                data.attribute = split_id;
                                data.percentage = entry.percentage;
                                var new_entry = new Backbone.Model(data);
                                splits.add(new_entry);
                            }
                            tObj.action = new gApp.models[transActionName]({
                                split: splits,
                                quantifier: va,
                                onlySplitOnce: obj.action.onlySplitOnce,
                            });
                            break;
                        case "Remove String":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        case "Lowercase String":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        case "Join Attributes":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];
                            var new_joins = [];
                            for (
                                var joins = 0;
                                joins < obj.action.join.length;
                                joins++
                            ) {
                                var join = obj.action.join[joins];
                                var join_id =
                                    //join.attribute.match(/^(\w*?\.(\d*))$/);
					join.attribute.match(/\.(\d*)$/);
                                join_id = join_id ? join_id[1] : join.attribute;

                                new_joins.push({
                                    attribute: cdh_copy_paste.replaces
                                        .attributes[join_id]
                                        ? gApp.inMemoryModels
                                              .quantifierCollection._byId[
                                              cdh_copy_paste.replaces
                                                  .attributes[join_id]
                                          ].attributes.fullyQualifiedId
                                        : join.attribute,
                                    type: join.type,
                                });
                            }

                            tObj.action = new gApp.models[transActionName]({
                                join: new Backbone.Collection(new_joins),
                                quantifier: va,
                                delimiter: obj.action.delimiter,
                            });
                            break;
                        case "Set String to Date":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var o2_old_id = obj.action.operand2Quantifier.id;
                            var o2_new_id = this.replaces.attributes[o2_old_id];
                            var o2 =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    o2_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                format: obj.action.format,
                                operand2Quantifier: o2,
                            });
                            break;

                        //#endregion
                        //#region Tallys
                        case "Increment Tally":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            iid = obj.action.incrementValue.id;
                            iid_new = this.replaces.attributes[iid];
                            iid_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    iid_new
                                ];

                            var e_old_id = obj.action.utilityQuantifier.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                utilityQuantifier: ea,
                                incrementValue:
                                    iid_obj || obj.action.incrementValue,
                            });
                            break;
                        case "Increment Tally Value":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var iid = obj.action.incrementValue.id;
                            var iid_new = this.replaces.attributes[iid];
                            var iid_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    iid_new
                                ];

                            var e_old_id = obj.action.metricSetKey.id;
                            var e_new_id = this.replaces.attributes[e_old_id];
                            var ea =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    e_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricSetKey: ea || obj.action.metricSetKey,
                                incrementValue:
                                    iid_obj || obj.action.incrementValue,
                            });
                            break;
                        case "Increment Tally By Tally":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var iid = obj.action.incrementValue.id;
                            var iid_new = this.replaces.attributes[iid];
                            var iid_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    iid_new
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                incrementValue: iid_obj,
                            });
                            break;
                        case "Increment Tally By Set of Strings":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var iid = obj.action.incrementValue.id;
                            var iid_new = this.replaces.attributes[iid];
                            var iid_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    iid_new
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                incrementValue: iid_obj,
                            });
                            break;
                        case "Set Rolling Sum Based on Timeline":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var cap = obj.action.capturedMetricSet.id;
                            var cap_new = this.replaces.attributes[cap];
                            var cap_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    cap_new
                                ];

                            var seq = obj.action.sequenceQuantifier.id;
                            var seq_new = this.replaces.attributes[seq];
                            var seq_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    seq_new
                                ];
                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                capturedMetricSet: cap_obj,
                                sequenceQuantifier: seq_obj,
                            });
                            break;
                        case "Set Rolling Average Based on Timeline":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var cap = obj.action.capturedMetricSet.id;
                            var cap_new = this.replaces.attributes[cap];
                            var cap_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    cap_new
                                ];

                            var seq = obj.action.sequenceQuantifier.id;
                            var seq_new = this.replaces.attributes[seq];
                            var seq_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    seq_new
                                ];
                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                capturedMetricSet: cap_obj,
                                sequenceQuantifier: seq_obj,
                            });
                            break;
                        case "Set Tally By Corresponding Arrays":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var eq1 = obj.action.eventQuantifier1.id;
                            var eq1new = this.replaces.attributes[eq1];
                            var eq1obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    eq1new
                                ];

                            var eq2 = obj.action.eventQuantifier2.id;
                            var eq2new = this.replaces.attributes[eq2];
                            var eq2obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    eq2new
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                eventQuantifier1: eq1obj,
                                eventQuantifier2: eq2obj,
                            });

                            break;
                        case "Remove Tally":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                            });
                            break;
                        case "Remove An Entry In A Tally":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var msk = obj.action.metricSetKey.id;
                            var msk_new = this.replaces.attributes[msk];
                            var msk_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    msk_new
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                metricSetKey:
                                    msk_obj || obj.action.metricSetKey,
                            });
                            break;
                        case "Increment By 1 for each item in an Array":
                            var v_old_id = obj.action.quantifier.id;
                            var v_new_id = this.replaces.attributes[v_old_id];
                            var va =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    v_new_id
                                ];

                            var source = obj.action.sourceQuantifier.id;
                            var source_new = this.replaces.attributes[source];
                            var source_obj =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    source_new
                                ];

                            tObj.action = new gApp.models[transActionName]({
                                quantifier: va,
                                sourceQuantifier: source_obj,
                            });
                            break;
                        //#endregion
                        //#region Timelines
                        //#endregion
                        //#region Visitor IDs
                        case "Set Visitor ID":
                            // what shall we do here?
                            break;
                        //#endregion
                    }

                    // create new transformation and add to gApp and UI
                    var t = gApp.inMemoryModels.transformationCollection.add(
                        new gApp.models.Transformation(tObj)
                    );
                    return tObj.id;
                } catch (e) {
                    console.log("CDH_COPY_PASTE ERROR - " + e);
                    if (document.cookie.indexOf("ccp_debug") > -1) {
                        debugger;
                    }
                }
            },
            processClipboard: async function () {
                try {
                    var imported = await cdh_copy_paste.readClipboard(
                        "cdh_clipboard"
                    );
                    if (imported) {
                        try {
                            cdh_copy_paste.clipboard = JSON.parse(
                                decodeURIComponent(escape(atob(imported)))
                            );
                        } catch (e) {
                            alert("There was an error reading the clipboard");
                            return;
                        }
                    }
                    cdh_copy_paste.replaces = {};

                    cdh_copy_paste.labelid = _store.labels.items.filter(
                        (e) => e.name == "CDH Copy Paste"
                    )[0];
                    if (!cdh_copy_paste.labelid) {
                        var label = new _store.labels.Item({
                            color: "red",
                            name: "CDH Copy Paste",
                            id: gApp.utils.uuid(),
                        });
                        _store.labels.add(label);
                        _store.labels.setLabels(
                            _store.labels.items.map((e) => e)
                        );
                        cdh_copy_paste.labelid = label.id;
                    } else {
                        cdh_copy_paste.labelid = cdh_copy_paste.labelid.id;
                    }

                    // add attributes without enrichments
                    cdh_copy_paste.replaces.attributes = {};
                    for (var id in cdh_copy_paste.clipboard.attributes) {
                        // check if attribute already exists
                        var att = cdh_copy_paste.clipboard.attributes[id]
                            .attributes
                            ? cdh_copy_paste.clipboard.attributes[id].attributes
                            : cdh_copy_paste.clipboard.attributes[id];
                        var qualified = att.fullyQualifiedId;
                        var old = cdh_copy_paste.qualifiedId[qualified];

                        if (att.tag_info) {
                            // Skip Tag attributes for now, maybe we'll work on them later
                            continue;
                        }

                        // check for clashes
                        var replace_id = "";
                        if (cdh_copy_paste.merge[att.id]) {
                            // this should be overwritten
                            var current_id =
                                cdh_copy_paste.clashes.atts[
                                    `${att.context.displayName}.${att.type.prefix}${att.name}`
                                ];
                            var current_att =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    current_id
                                ].attributes;
                            // delete existing enrichments
                            replace_id = current_att.id;
                            for (
                                var i = 0;
                                i < current_att.transformationIds.length;
                                i++
                            ) {
                                gApp.inMemoryModels.transformationCollection.remove(
                                    gApp.inMemoryModels.transformationCollection.filter(
                                        (e) =>
                                            e.get("id") ==
                                            current_att.transformationIds[i]
                                    )[0]
                                );
                            }
                            current_att.transformationIds = [];
                            current_att.labelIds = [cdh_copy_paste.labelid];
                            current_att.updatedBy =
                                gApp.utils.user.getUserEmail();
                            current_att.updatedDate = new Date().toISOString();
                        }
                        /* old no merge logic
            if (old && qualified && qualified.indexOf("current_visit.last_event") > -1) {
              cdh_copy_paste.replaces.attributes[id] = old;
            } else {
              cdh_copy_paste.replaces.attributes[id] = cdh_copy_paste.addAttribute(att);
            }
            */
                        if (replace_id) {
                            cdh_copy_paste.replaces.attributes[id] = replace_id;
                        } else {
                            cdh_copy_paste.replaces.attributes[id] =
                                cdh_copy_paste.addAttribute(att);
                        }
                    }

                    // add all identified rules
                    cdh_copy_paste.replaces.rules = {};
                    for (var id in cdh_copy_paste.clipboard.rules) {
                        var rule = cdh_copy_paste.clipboard.rules[id].attributes
                            ? cdh_copy_paste.clipboard.rules[id].attributes
                            : cdh_copy_paste.clipboard.rules[id];

                        /* Maybe this isnt needed anymore
            var logic = rule.logic;
            for (var new_att in cdh_copy_paste.replaces.attributes) {
              //var old_id = gApp.inMemoryModels.quantifierCollection._byId[new_att].getFullyQualifiedId()
              var old = cdh_copy_paste.clipboard.attributes[new_att].attributes
                ? cdh_copy_paste.clipboard.attributes[new_att].attributes
                : cdh_copy_paste.clipboard.attributes[new_att];
              var old_id = old.fullyQualifiedId;

              var new_id = old_id.replace(
                new_att,
                cdh_copy_paste.replaces.attributes
                  ? cdh_copy_paste.replaces.attributes[new_att]
                  : cdh_copy_paste.replaces[new_att]
              );
              var old_id = new RegExp(old_id, "g");
              logic = logic.replace(old_id, new_id);
            }

            rule.logic = logic;
            */
                        cdh_copy_paste.replaces.rules[id] =
                            cdh_copy_paste.addRule(rule);
                    }
                    cdh_copy_paste.getQualifiedId();
                    // add enrichments
                    // new method to process them in enrichment order.
                    cdh_copy_paste.replaces.enrichments = {};
                    var sorted_enrichments = Object.values(
                        cdh_copy_paste.clipboard.enrichments
                    ).sort((a, b) => {
                        return a.orderIndex - b.orderIndex;
                    });
                    for (var se = 0; se < sorted_enrichments.length; se++) {
                        var trans = sorted_enrichments[se].attributes
                            ? sorted_enrichments[se].attributes
                            : sorted_enrichments[se];
                        var id = trans.id;
                        if (trans.type.displayName !== "Set Visitor ID") {
                            cdh_copy_paste.replaces.enrichments[id] =
                                cdh_copy_paste.addEnrichment(trans);
                        }
                    }
                    /*
          for (var id in cdh_copy_paste.clipboard.enrichments) {
            var trans = cdh_copy_paste.clipboard.enrichments[id].attributes
              ? cdh_copy_paste.clipboard.enrichments[id].attributes
              : cdh_copy_paste.clipboard.enrichments[id];
              if (trans.type.displayName !== "Set Visitor ID"){
                cdh_copy_paste.replaces.enrichments[id] = cdh_copy_paste.addEnrichment(
                  trans
                );
              }
          }
          */
                    // add enrichments to attributes
                    for (var id in cdh_copy_paste.clipboard.attributes) {
                        var new_att_id =
                            cdh_copy_paste.replaces.attributes[
                                cdh_copy_paste.clipboard.attributes[id].id
                            ];
                        var new_att =
                            gApp.inMemoryModels.quantifierCollection._byId[
                                new_att_id
                            ];
                        var trans = cdh_copy_paste.clipboard.attributes[id]
                            .attributes
                            ? cdh_copy_paste.clipboard.attributes[id].attributes
                                  .transformationIds
                            : cdh_copy_paste.clipboard.attributes[id]
                                  .transformationIds;
                        trans = trans || [];
                        for (var i = 0; i < trans.length; i++) {
                            var new_tran =
                                cdh_copy_paste.replaces.enrichments[trans[i]];
                            if (
                                new_tran &&
                                !(
                                    gApp.inMemoryModels.transformationCollection
                                        ._byId[new_tran].attributes.preloaded &&
                                    new_att.attributes.preloaded
                                )
                            ) {
                                new_att.attributes.transformationIds.push(
                                    new_tran
                                );
                            }
                        }
                    }
                    // add refers that were late
                    if (cdh_copy_paste.faves) {
                        for (var f_att_id in cdh_copy_paste.faves) {
                            f_att =
                                gApp.inMemoryModels.quantifierCollection._byId[
                                    f_att_id
                                ];
                            if (f_att) {
                                f_att.attributes.refers =
                                    this.replaces.attributes[
                                        cdh_copy_paste.faves[f_att_id]
                                    ];
                            }
                        }
                        cdh_copy_paste.faves = {};
                    }
                    // add audiences
                    cdh_copy_paste.replaces.audiences = {};
                    for (var id in cdh_copy_paste.clipboard.audiences) {
                        var audience = cdh_copy_paste.clipboard.audiences[id]
                            .attributes
                            ? cdh_copy_paste.clipboard.audiences[id].attributes
                            : cdh_copy_paste.clipboard.audiences[id];

                        cdh_copy_paste.replaces.audiences[id] =
                            await cdh_copy_paste.addAudience(audience);
                    }
                    // add event feeds
                    cdh_copy_paste.replaces.eventfeeds = {};
                    for (var id in cdh_copy_paste.clipboard.eventfeeds) {
                        var feed = cdh_copy_paste.clipboard.eventfeeds[id]
                            .attributes
                            ? cdh_copy_paste.clipboard.eventfeeds[id].attributes
                            : cdh_copy_paste.clipboard.eventfeeds[id];

                        cdh_copy_paste.replaces.eventfeeds[id] =
                            cdh_copy_paste.addEventFeed(feed);
                    }

                    // add connectors
                    cdh_copy_paste.replaces.connectors = {};
                    for (var id in cdh_copy_paste.clipboard.connectors) {
                        var conn = cdh_copy_paste.clipboard.connectors[id]
                            .attributes
                            ? cdh_copy_paste.clipboard.connectors[id].attributes
                            : cdh_copy_paste.clipboard.connectors[id];

                        cdh_copy_paste.replaces.connectors[id] =
                            cdh_copy_paste.addConnector(conn);
                    }
                    // get qual id's again - updated for new attributes
                    cdh_copy_paste.getQualifiedId();

                    // add actions
                    cdh_copy_paste.replaces.actions = {};
                    for (var id in cdh_copy_paste.clipboard.actions) {
                        var action = cdh_copy_paste.clipboard.actions[id]
                            .attributes
                            ? cdh_copy_paste.clipboard.actions[id].attributes
                            : cdh_copy_paste.clipboard.actions[id];

                        cdh_copy_paste.replaces.actions[id] =
                            cdh_copy_paste.addAction(action);
                    }

                    alert(
                        "clipboard has been copied to this profile - Please check your configuration"
                    );
                    var old_hash = window.location.hash;
                    window.location.hash = "#home";
                    setTimeout(() => (window.location.hash = old_hash), 100);

                    gApp.utils.modal.hide();
                } catch (e) {
                    console.log("CCP ERROR: " + e);
                    alert(
                        "There was an error processing the clipboard - please contact james.lingham@tealium.com"
                    );
                }
            },
            getQualifiedId: function () {
                cdh_copy_paste.qualifiedId = {};
                for (
                    var i = 0;
                    i < gApp.inMemoryModels.quantifierCollection.length;
                    i++
                ) {
                    var x = gApp.inMemoryModels.quantifierCollection.models[i];
                    cdh_copy_paste.qualifiedId[x.attributes.fullyQualifiedId] =
                        x.id;
                }
            },
            viewClipboard: async function () {
                // get latest from LocalStorage
                var imported = await cdh_copy_paste.readClipboard(
                    "cdh_clipboard"
                );
                if (imported) {
                    try {
                        cdh_copy_paste.clipboard = JSON.parse(
                            decodeURIComponent(escape(atob(imported)))
                        );
                    } catch (e) {
                        alert("There was an error reading the clipboard");
                        return;
                    }
                }
                // View Clipboard
                var accordians = [];
                var types = Object.keys(cdh_copy_paste.clipboard).sort();
                for (let i = 0; i < types.length; i++) {
                    var rows = [];
                    var content = "";
                    prop = types[i];
                    if (prop == "attributes") {
                        Object.values(
                            cdh_copy_paste.clipboard.attributes
                        ).forEach((e) => {
                            rows.push(`<tr>
                    <td>${e.name}</td>
                    <td><i class="fa ${e.type.icon}"> </i> ${
                                e.type.displayName
                            }</td>
                    <td>${e.context.value}</td>
                    <td> ${e.preloaded ? "Preloaded" : "Custom"}</td>
                    </tr>`);
                        });

                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Type</th><th>Scope</th><th>Preloaded</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Attributes on the clipboard </p>";
                        }
                    } else if (prop == "rules") {
                        Object.values(cdh_copy_paste.clipboard.rules).forEach(
                            (e) => {
                                rows.push(`<tr>
                    <td>${e.name}</td>
                    <td> ${e.preloaded ? "Preloaded" : "Custom"}</td>
                    </tr>`);
                            }
                        );

                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Preloaded</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Rules on the clipboard </p>";
                        }
                    } else if (prop == "actions") {
                        Object.values(cdh_copy_paste.clipboard.actions).forEach(
                            (e) => {
                                rows.push(`<tr>
                <td>${e.name}</td>
                <td>${e.type}</td>
                <td>${e.source.type}</td>
                <td>${e.trigger}</td>
                </tr>`);
                            }
                        );

                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Type</th><th>Scope</th><th>Trigger</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Actions on the clipboard </p>";
                        }
                        content = `${content}
                <br>`;
                    } else if (prop == "connectors") {
                        Object.values(
                            cdh_copy_paste.clipboard.connectors
                        ).forEach((e) => {
                            rows.push(`<tr>
                    <td>${e.name}</td>
                    <td>${e.type}</td>
                    </tr>`);
                        });

                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Type</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Connectors currently on the clipboard </p>";
                        }
                        content = `${content}
                <br>`;
                    } else if (prop == "eventfeeds") {
                        Object.values(
                            cdh_copy_paste.clipboard.eventfeeds
                        ).forEach((e) => {
                            rows.push(`<tr>
                    <td>${e.name}</td>
                    </tr>`);
                        });
                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Event Feeds on the clipboard</p>";
                        }
                        content = `${content}
                <br>`;
                    } else if (prop == "audiences") {
                        Object.values(
                            cdh_copy_paste.clipboard.audiences
                        ).forEach((e) => {
                            rows.push(`<tr>
                    <td>${e.name}</td>
                    </tr>`);
                        });

                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Audiences on the clipboard </p>";
                        }
                        content = `${content}
            <br>`;
                    } else if (prop == "enrichments") {
                        Object.values(
                            cdh_copy_paste.clipboard.enrichments
                        ).forEach((e) => {
                            rows.push(`<tr>
                    <td>${e.name}</td>
                    <td>${e.type.displayName}</td>
                    <td>${e.trigger.displayName}</td>
                    <td> ${e.preloaded ? "Preloaded" : "Custom"}</td>
                    </tr>`);
                        });
                        if (rows.length) {
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                    <th>Name</th><th>Type</th><th>Trigger</th><th>Preloaded</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no Enrichments on the clipboard </p>";
                        }
                        content = `${content}
            <br>`;
                    } else if (prop == "eventspecs") {
                        continue;
                    }
                    accordians.push(`
            <button class="ccp_accordion">${
                prop.charAt(0).toUpperCase() + prop.slice(1)
            } (${rows.length})</button>
            <div id="${prop}" class="ccp_panel">
                ${content}
            </div>`);
                }
                var currentClipboardModal = new gApp.views.SimpleModalView({
                    model: new Backbone.Model({
                        title: "Current Clipboard",
                        hideCancel: false,
                        message: `<style>
                div.cancel {
                    display:none
                    }
                .ccp_accordion {
                background-color: #eee;
                color: #444;
                cursor: pointer;
                padding: 10px;
                height: auto;
                width: 100%;
                border: none;
                text-align: left;
                outline: none;
                font-size: 15px;
                transition: 0.4s;
                }
                
                .ccp_active, .ccp_accordion:hover {
                background-color: #ccc;
                }
                
                .ccp_accordion:after {
                content: ${"'\u002B'"};
                color: #777;
                font-weight: bold;
                float: right;
                margin-left: 5px;
                }
                
                .ccp_active:after {
                content: ${"'\u2212'"};
                }
                
                .ccp_panel {
                padding: 0 18px;
                background-color: white;
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.2s ease-out;
                }
                </style>
                <div id="ccp_accordians">
                    ${accordians.join("")}
                </div>
                
            <p hidden id='connectors_error'> There was an error pasting the clipboard</p>`,
                        buttons: [
                            {
                                id: "merge_check_close",
                                text: "Close",
                                location: "left",
                                handler: () => {
                                    gApp.utils.modal.hide();
                                    if (
                                        gApp.app["modalTier2"] &&
                                        gApp.app["modalTier2"].currentView
                                    ) {
                                        gApp.app["modalTier2"].cleanUp();
                                    }
                                },
                            },
                        ],
                    }),
                });
                currentClipboardModal.el.className =
                    currentClipboardModal.el.className.replace(
                        "modal-xs",
                        "modal-md"
                    );
                currentClipboardModal.el.setAttribute(
                    "ccp-id",
                    "current_clipboard_view"
                );
                gApp.utils.modal.show(currentClipboardModal);
                var empty_clipboard = cdh_copy_paste.util.isEmptyObject(
                    cdh_copy_paste.util.remove_empty(
                        JSON.parse(JSON.stringify(cdh_copy_paste.clipboard))
                    )
                );
                $(`<div id="clear_clipboard" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" style="margin-left: 10px !important;" data-test="default_simple_modal_action_btn"><i class="far fa-trash-alt mr-1"></i> Empty Clipboard</div>
        <div id="import_clipboard" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" style="margin-left: 10px !important;" data-test="default_simple_modal_action_btn"><i class="far fa-pencil mr-1"></i> Import / Export Clipboard</div>
          ${
              empty_clipboard
                  ? ""
                  : '<div id="paste_clipboard" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" style="margin-left: 10px !important;" data-test="default_simple_modal_action_btn"><i class="fa fa-clipboard mr-1"></i> Paste Clipboard</div>'
          }`).insertAfter(
                    'div[ccp-id="current_clipboard_view"] > div > div[data-test="default_simple_modal_action_btn"]'
                );
                $("#import_clipboard").click(cdh_copy_paste.importClipboard);
                $("#clear_clipboard").click(() => {
                    cdh_copy_paste.emptyClipboard();
                    gApp.utils.modal.hide();
                    if (
                        gApp.app["modalTier2"] &&
                        gApp.app["modalTier2"].currentView
                    ) {
                        gApp.app["modalTier2"].cleanUp();
                    }
                    cdh_copy_paste.viewClipboard();
                });
                $("#paste_clipboard").click(() => {
                    gApp.utils.modal.hide();
                    if (
                        gApp.app["modalTier2"] &&
                        gApp.app["modalTier2"].currentView
                    ) {
                        gApp.app["modalTier2"].cleanUp();
                    }
                    //cdh_copy_paste.viewClipboard();
                    cdh_copy_paste.viewClashes();
                });

                var acc = document.getElementsByClassName("ccp_accordion");
                for (var i = 0; i < acc.length; i++) {
                    acc[i].addEventListener("click", function () {
                        this.classList.toggle("ccp_active");
                        var panel = this.nextElementSibling;
                        if (panel.style.maxHeight) {
                            panel.style.maxHeight = null;
                        } else {
                            panel.style.maxHeight = panel.scrollHeight + "px";
                        }
                    });
                }
            },
            emptyClipboard: async function () {
                window.cdh_copy_paste.clipboard = {
                    eventfeeds: {},
                    eventspecs: {},
                    audiences: {},
                    attributes: {},
                    enrichments: {},
                    rules: {},
                    connectors: {},
                    actions: {},
                };
                jQuery("input.att_select:checked").each(async (i, e) => {
                    e.checked = false;
                    e.indeterminate = false;
                });
                (await cdh_copy_paste.saveClipboard(
                    "cdh_clipboard",
                    window.cdh_copy_paste.clipboard
                ))
                    ? alert("clipboard has been emptied")
                    : "";

                /*
        if (await cdh_copy_paste.storage.getCapacity() > -1){
          var saved = cdh_copy_paste.storage.setContents(
            "cdh_clipboard",
            btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
          ).then(e=>{ return true});
        } else {
          window.localStorage.setItem(
            "cdh_clipboard",
            btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
          );
        }*/
                //alert("clipboard has been emptied");
            },
            addCheckboxes: function () {
                //do we have the copy selected button
                if ($("#copy_button").length) {
                    /* Platform update added these for us
            if(cdh_copy_paste.current_page == "attribute"){
                if ($('.att_select').length == 0){
                    jQuery(
                        '<input style="float:left;" class="att_select" type="checkbox">'
                    ).insertBefore(
                        ".as-accordion-header, .quantifier-accordion-placeholder"
                    );
                }
            }
            */
                    if (cdh_copy_paste.current_page == "audience") {
                        if ($(".att_select").length == 0) {
                            jQuery(
                                '<input style="float:left;" class="att_select" type="checkbox">'
                            ).insertBefore(
                                ".as-accordion-header, .audience-accordion-placeholder"
                            );
                        }
                    }
                    if (cdh_copy_paste.current_page == "event-feed") {
                        if ($(".att_select").length == 0) {
                            jQuery(
                                '<input style="float:left;" class="att_select" type="checkbox">'
                            ).insertBefore(
                                ".as-accordion-header, .audience-accordion-placeholder"
                            );
                        }
                    }
                }
            },
            viewClashes: function () {
                // Get existing atts in the current profile
                cdh_copy_paste.clashes = {};
                cdh_copy_paste.clashes.atts = {};
                cdh_copy_paste.clashes.audiences = {};
                cdh_copy_paste.clashes.feeds = {};
                cdh_copy_paste.clashes.specs = {};
                cdh_copy_paste.clashes.conns = {};
                cdh_copy_paste.clashes.actions = {};
                cdh_copy_paste.feedToSpec = {};
                Object.values(cdh_copy_paste.clipboard.eventspecs).forEach(s=>{
                    if (s.attributes.linkedFilteredStreamId){
                        cdh_copy_paste.feedToSpec[s.attributes.linkedFilteredStreamId] = s.attributes.tealiumEvent
                    }
                })
                gApp.inMemoryModels.quantifierCollection.models.forEach((e) => {
                    cdh_copy_paste.clashes.atts[
                        `${e.attributes.context.displayName}.${e.attributes.type.prefix}${e.attributes.name}`
                    ] = e.attributes.id;
                });
                _store.audiences.visibleItems.forEach((e) => {
                    cdh_copy_paste.clashes.audiences[e.name] = e.id;
                });
                _store.eventFeeds.items.forEach((e) => {
                    cdh_copy_paste.clashes.feeds[e.name] = e.id;
                });
                _store.eventSpecs.items.forEach((e) => {
                    cdh_copy_paste.clashes.specs[e.tealiumEvent] = e.id;
                });
                _store.eventFeeds.items.forEach((e) => {
                    cdh_copy_paste.clashes.feeds[e.name] = e.id;
                });
                _store.connectors.visibleItems.forEach((e) => {
                    cdh_copy_paste.clashes.conns[`${e.type}.${e.name}`] = e.id;
                });
                _store.actions.visibleItems.forEach((e) => {
                    var conn = _store.connectors.visibleItems.filter(
                        (c) => c.id == e.connectorId
                    );
                    var conn_name = `${conn[0].type}.${conn[0].name}`;

                    if (e.source.type == "VISITOR") {
                        //var source_id = cdh_copy_paste.replaces.audiences[obj.source.id] || e.source.id;
                        var source = _store.audiences.visibleItems.filter(
                            (c) => c.id == e.source.id
                        );
                        var source_name = `audience.${source[0].name}`;
                    } else if (e.source.type == "EVENT") {
                        //var source_id = cdh_copy_paste.replaces.eventfeeds[obj.source.id] || e.source.id;
                        var source = _store.eventFeeds.items.filter(
                            (c) => c.id == e.source.id
                        );
                        var source_name = `event.${source[0].name}`;
                    }
                    cdh_copy_paste.clashes.actions[
                        `${conn_name}.${source_name}.${e.type}.${e.name}.${e.trigger}`
                    ] = e.id;
                });

                //
                var accordians = [];
                var types = Object.keys(cdh_copy_paste.clipboard).sort();
                for (let i = 0; i < types.length; i++) {
                    var rows = [];
                    var content = "";
                    prop = types[i];
                    cdh_copy_paste.merge = cdh_copy_paste.merge || {};
                    if (prop == "attributes") {
                        Object.values(
                            cdh_copy_paste.clipboard.attributes
                        ).forEach((e) => {
                            //check for clash
                            var id = `${e.context.displayName}.${e.type.prefix}${e.name}`;
                            var clash = cdh_copy_paste.clashes.atts[id];
                            if (!e.preloaded && clash) {
                                rows.push(`<tr>
                    <td>${e.name}</td>
                    <td><i class="fa ${e.type.icon}"> </i>${
                                    e.type.displayName.charAt(0).toUpperCase() +
                                    e.type.displayName.slice(1)
                                }</td>
                    <td>${e.context.value}</td>
                    <td> ${clash ? clash : ""}</td>
                    <td><input 
                        id="att_ccp_merge_${e.id}" 
                        type="checkbox" 
                        ${
                            e.preloaded
                                ? "disabled"
                                : e.context.displayName == "event"
                                ? (cdh_copy_paste.merge[e.id] = true) &&
                                  "checked disabled"
                                : cdh_copy_paste.merge[e.id]
                                ? "checked"
                                : ""
                        }
                    ></td>
                    </tr>`);
                                cdh_copy_paste.merge[e.id] =
                                    !!cdh_copy_paste.merge[e.id];
                            }
                        });

                        if (rows.length) {
                            rows.push(`<tr>
                    <td colspan="4"></td>
                        <td><input id="att_select_all" type="checkbox"> Select All </td>
                    </tr>`);
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Type</th><th>Scope</th><th>Existing ID</th><th>Overwrite</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no clashes with existing Attributes </p>";
                        }
                        content = `${content}
                <ul>
                    <li>Preloaded Attributes will not be copied</li>
                    <li>Event Attributes cannot have duplicates, and will always be overwritten</.>
                </ul><br>`;
                    } else if (prop == "enrichments") {
                        content =
                            "<p> Enrichments will be handled the same way as the attribute they are assigned too. Overwritten attributes will have their enrichments removed and replace with incoming enrichments. </p>";
                    } else if (prop == "rules") {
                        content =
                            "<p> Rules will automatically be de-duplicated - If logic is identical, the existing rule will be used </p>";
                    } else if (prop == "actions") {
                        Object.values(cdh_copy_paste.clipboard.actions).forEach(
                            (e) => {
                                var conn = Object.values(
                                    cdh_copy_paste.clipboard.connectors
                                ).filter((c) => c.id == e.connectorId);
                                var conn_name = `${conn[0].type}.${conn[0].name}`;

                                if (e.source.type == "VISITOR") {
                                    var source = Object.values(
                                        cdh_copy_paste.clipboard.audiences
                                    ).filter((c) => c.id == e.source.id);
                                    var source_name = `audience.${source[0].name}`;
                                } else if (e.source.type == "EVENT") {
                                    var source = Object.values(
                                        cdh_copy_paste.clipboard.eventfeeds
                                    ).filter((c) => c.id == e.source.id);
                                    var source_name = `event.${source[0].name}`;
                                }

                                //check for clash
                                var id = `${conn_name}.${source_name}.${e.type}.${e.name}.${e.trigger}`;
                                var clash = cdh_copy_paste.clashes.actions[id];
                                if (!e.preloaded && clash) {
                                    rows.push(`<tr>
                    <td>${e.name}</td>
                    <td>${e.type}</td>
                    <td>${e.source.type}</td>
                    <td>${e.trigger}</td>
                    <td><input 
                        id="act_ccp_merge_${e.id}" 
                        type="checkbox" 
                        ${cdh_copy_paste.merge[e.id] ? "checked" : ""}
                    ></td>
                    </tr>`);
                                    cdh_copy_paste.merge[e.id] =
                                        !!cdh_copy_paste.merge[e.id];
                                }
                            }
                        );

                        if (rows.length) {
                            rows.push(`<tr>
                    <td colspan="4"></td>
                        <td><input id="act_select_all" type="checkbox"> Select All </td>
                    </tr>`);
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Type</th><th>Scope</th><th>Trigger</th><th>Overwrite</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no clashes with existing Connectors </p>";
                        }
                        content = `${content}
                <ul>
                    <li>Clashing Actions are identified based off action type, name, trigger, connector type and name</li>
                    <li>Clashing Actions not overwritten will be created with a new name</li>
                </ul><br>`;
                    } else if (prop == "connectors") {
                        Object.values(
                            cdh_copy_paste.clipboard.connectors
                        ).forEach((e) => {
                            //check for clash
                            var id = `${e.type}.${e.name}`;
                            var clash = cdh_copy_paste.clashes.conns[id];
                            if (!e.preloaded && clash) {
                                rows.push(`<tr>
                    <td>${e.name}</td>
                    <td>${e.type}</td>
                    <td><input 
                        id="con_ccp_merge_${e.id}" 
                        type="checkbox" 
                        ${cdh_copy_paste.merge[e.id] ? "checked" : ""}
                    ></td>
                    </tr>`);
                                cdh_copy_paste.merge[e.id] =
                                    !!cdh_copy_paste.merge[e.id];
                            }
                        });

                        if (rows.length) {
                            rows.push(`<tr>
                    <td colspan="2"></td>
                        <td><input id="con_select_all" type="checkbox"> Select All </td>
                    </tr>`);
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Type</th><th>Overwrite</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no clashes with existing Connectors </p>";
                        }
                        content = `${content}
                <ul>
                    <li>Clashing connectors are identified based off connector type and name</li>
                    <li>Clashing connectors not overwritten will be created with a new name</li>
                </ul><br>`;
                    } else if (prop == "eventfeeds") {
                        Object.values(
                            cdh_copy_paste.clipboard.eventfeeds
                        ).forEach((e) => {
                            //check for clash
                            var id = `${e.name}`;
                            var spec_clash = !!cdh_copy_paste.clashes.specs[cdh_copy_paste.feedToSpec[e.id]]
                            var clash = cdh_copy_paste.clashes.feeds[id] || spec_clash;
                            if (!e.preloaded && clash) {
                                rows.push(`<tr>
                    <td>${e.name}</td>
                    <td><input 
                        id="feed_ccp_merge_${e.id}" 
                        type="checkbox" 
                        ${spec_clash ? (cdh_copy_paste.merge[e.id] = true) && "checked disabled" : cdh_copy_paste.merge[e.id] ? "checked" : ""}
                    ></td>
                    </tr>`);
                                cdh_copy_paste.merge[e.id] =
                                    !!cdh_copy_paste.merge[e.id];
                            }
                        });

                        if (rows.length) {
                            rows.push(`<tr>
                    <td></td>
                        <td><input id="feed_select_all" type="checkbox"> Select All </td>
                    </tr>`);
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Overwrite</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no clashes with existing Event Feeds </p>";
                        }
                        content = `${content}
                <ul>
                    <li>The "All Events" Feed will not be copied</li>
                    <li>EventFeed Names must be unique</li>
                    <li>Clashing EventFeeds not overwritten will be created with a new name</li>
                    <li>Clashing EventSpecs will always be overwritten</li>
                </ul><br>`;
                    } else if (prop == "audiences") {
                        Object.values(
                            cdh_copy_paste.clipboard.audiences
                        ).forEach((e) => {
                            //check for clash
                            var id = `${e.name}`;
                            var clash = cdh_copy_paste.clashes.audiences[id];
                            if (!e.preloaded && clash) {
                                rows.push(`<tr>
                    <td>${e.name}</td>
                    <td><input 
                        id="aud_ccp_merge_${e.id}" 
                        type="checkbox" 
                        ${cdh_copy_paste.merge[e.id] ? "checked" : ""}
                    ></td>
                    </tr>`);
                                cdh_copy_paste.merge[e.id] =
                                    !!cdh_copy_paste.merge[e.id];
                            }
                        });

                        if (rows.length) {
                            rows.push(`<tr>
                    <td></td>
                        <td><input id="aud_select_all" type="checkbox"> Select All </td>
                    </tr>`);
                            content = `<table style="width: -webkit-fill-available;">
                    <tr style="font-weight: bold; font-size: large;">
                        <th>Name</th><th>Overwrite</th>
                    </tr>
                    ${rows.join("")}</table>`;
                        } else {
                            content =
                                "<p> There are no clashes with existing Audiences </p>";
                        }
                        content = `${content}
                <ul>
                    <li>Audiences Names must be unique</li>
                    <li>Clashing Audiences not overwritten will be created with a new name</li>
                </ul><br>`;
                    } else if (prop == "eventspecs") {
                        continue;
                    }

                    accordians.push(`
            <button class="ccp_accordion">${
                prop.charAt(0).toUpperCase() + prop.slice(1)
            }</button>
            <div id="${prop}" class="ccp_panel">
                ${content}
            </div>`);
                }

                var clashModal = new gApp.views.SimpleModalView({
                    model: new Backbone.Model({
                        title: "Check for clashes",
                        hideCancel: false,
                        message: `<style>
                div.cancel {
                    display:none
                    }
                .ccp_accordion {
                  background-color: #eee;
                  color: #444;
                  cursor: pointer;
                  padding: 10px;
                  height: auto;
                  width: 100%;
                  border: none;
                  text-align: left;
                  outline: none;
                  font-size: 15px;
                  transition: 0.4s;
                }
                
                .ccp_active, .ccp_accordion:hover {
                  background-color: #ccc;
                }
                
                .ccp_accordion:after {
                  content: ${"'\u002B'"};
                  color: #777;
                  font-weight: bold;
                  float: right;
                  margin-left: 5px;
                }
                
                .ccp_active:after {
                  content: ${"'\u2212'"};
                }
                
                .ccp_panel {
                  padding: 0 18px;
                  background-color: white;
                  max-height: 0;
                  overflow: hidden;
                  transition: max-height 0.2s ease-out;
                }
                </style>
                <div id="ccp_accordians">
                    ${accordians.join("")}
                </div>
                
            <p hidden id='connectors_error'> There was an error pasting the clipboard</p>`,
                        buttons: [
                            {
                                id: "merge_check_close",
                                text: "Close",
                                location: "left",
                                handler: () => {
                                    gApp.utils.modal.hide();
                                    if (
                                        gApp.app["modalTier2"] &&
                                        gApp.app["modalTier2"].currentView
                                    ) {
                                        gApp.app["modalTier2"].cleanUp();
                                    }
                                },
                            },
                        ],
                    }),
                });
                clashModal.el.className = clashModal.el.className.replace(
                    "modal-xs",
                    "modal-md"
                );
                clashModal.el.setAttribute("ccp-id", "clash_view");
                gApp.utils.modal.show(clashModal);
                $(
                    '<div id="clipboard_paste_button" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" data-test="default_simple_modal_action_btn">Paste Clipboard</div>'
                ).insertAfter(
                    'div[ccp-id="clash_view"] > div > div[data-test="default_simple_modal_action_btn"]'
                );
                $("#clipboard_paste_button").click(
                    cdh_copy_paste.processClipboard
                );

                var acc = document.getElementsByClassName("ccp_accordion");
                for (var i = 0; i < acc.length; i++) {
                    acc[i].addEventListener("click", function () {
                        this.classList.toggle("ccp_active");
                        var panel = this.nextElementSibling;
                        if (panel.style.maxHeight) {
                            panel.style.maxHeight = null;
                        } else {
                            panel.style.maxHeight = panel.scrollHeight + "px";
                        }
                    });
                    acc[i].click();
                }
                jQuery('input[id*="_ccp_merge_"]').change((e) => {
                    cdh_copy_paste.merge[
                        e.currentTarget.id.split("_merge_")[1]
                    ] = e.currentTarget.checked;
                });
                jQuery('input[id$="_select_all"]').change((e) => {
                    var type = e.currentTarget.id.split("_")[0];
                    jQuery(`input[id^="${type}_ccp_merge_"]`).each((i, e2) => {
                        if (!e2.disabled) {
                            e2.checked = e.currentTarget.checked;
                            //cdh_copy_paste.merge[e2.id.replace("ccp_merge_","")] = e.currentTarget.checked;
                            cdh_copy_paste.merge[
                                e2.id.slice(
                                    `${
                                        e.currentTarget.id.split("_")[0]
                                    }_ccp_merge_`.length
                                )
                            ] = e.currentTarget.checked;
                        }
                    });
                });
            },

            importClipboard: async function () {
                var current_clipboard =
                    (await cdh_copy_paste.readClipboard("cdh_clipboard")) || "";
                //current_clipboard = current_clipboard ? atob(current_clipboard) : "";
                current_clipboard.eventspecs =
                    current_clipboard.eventspecs || {};
                //<textarea id='popup_clipboard' rows="10">${current_clipboard}</textarea>
                var clipboardModal = new gApp.views.SimpleModalView({
                    model: new Backbone.Model({
                        title: "Clipboard",
                        hideCancel: true,
                        message: `<style> textarea {
          width: 100%;
          -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
          -moz-box-sizing: border-box;    /* Firefox, other Gecko */
          box-sizing: border-box;         /* Opera/IE 8+ */
        }</style>
        
        <script>
          function readFile(input) {
            let file = input.files[0];
          
            let reader = new FileReader();
          
            reader.readAsText(file);
          
            reader.onload = function() {
                      
                      window.cdh_copy_paste.imported_clipboard = reader.result;
            };
          
            reader.onerror = function() {
              console.log(reader.error);
            };
          
          }
        </script>
        <input type="file" onchange="readFile(this)"><br>
        <p hidden id='clipboard_error'> There was an error importing the clipboard </p>`,
                        buttons: [
                            {
                                id: "clipboard_close",
                                text: "Close",
                                location: "left",
                                handler: () => {
                                    gApp.utils.modal.hide();
                                    if (
                                        gApp.app["modalTier2"] &&
                                        gApp.app["modalTier2"].currentView
                                    ) {
                                        gApp.app["modalTier2"].cleanUp();
                                    }
                                    cdh_copy_paste.viewClipboard();
                                },
                            },
                        ],
                    }),
                });
                clipboardModal.el.setAttribute(
                    "ccp-id",
                    "clipboard_import_view"
                );
                gApp.utils.modal.show(clipboardModal);
                /*$(`<div id="clipboard_copy_btn" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" data-test="default_simple_modal_action_btn">Copy</div>
        <div id="clipboard_import_btn" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" data-test="default_simple_modal_action_btn">Import</div>
        `)*/
                $(`<div id="clipboard_export_btn" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" data-test="default_simple_modal_action_btn">Export</div>
        <div id="clipboard_import_btn" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" data-test="default_simple_modal_action_btn">Import</div>
        `).insertAfter(
                    'div[ccp-id="clipboard_import_view"] > div > div[data-test="default_simple_modal_action_btn"]'
                );
                $("#clipboard_import_btn").click(async () => {
                    var updated = false;

                    //JSON.parse(decodeURIComponent(escape(atob(window.cdh_copy_paste.imported_clipboard))))
                    var clipboard = {};
                    clipboard.value = window.cdh_copy_paste.imported_clipboard;

                    if (clipboard && clipboard.value) {
                        try {
                            cdh_copy_paste.clipboard = JSON.parse(
                                clipboard.value
                            );
                            /*window.localStorage.setItem(
                      "cdh_clipboard",
                      btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
                    );
                    */
                            updated = await cdh_copy_paste.saveClipboard(
                                "cdh_clipboard",
                                window.cdh_copy_paste.clipboard
                            );
                        } catch (e) {
                            try {
                                cdh_copy_paste.clipboard = JSON.parse(
                                    decodeURIComponent(
                                        escape(atob(clipboard.value))
                                    )
                                );
                                /*window.localStorage.setItem(
                      "cdh_clipboard",
                      btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
                    );
                    */
                                updated = await cdh_copy_paste.saveClipboard(
                                    "cdh_clipboard",
                                    window.cdh_copy_paste.clipboard
                                );
                            } catch (e) {}
                        }
                    }
                    if (updated) {
                        gApp.utils.modal.hide();
                        gApp.utils.modal.hide();
                        if (
                            gApp.app["modalTier2"] &&
                            gApp.app["modalTier2"].currentView
                        ) {
                            gApp.app["modalTier2"].cleanUp();
                        }
                        cdh_copy_paste.viewClipboard();
                    } else {
                        var error_div =
                            document.getElementById("clipboard_error");
                        error_div &&
                            (error_div.innerText =
                                "There was an error importing to the clipboard") &&
                            error_div.removeAttribute("hidden");
                    }
                });
                $("#clipboard_copy_btn").click(() => {
                    var copied = false;
                    var clipboard = document.getElementById("popup_clipboard");
                    if (clipboard && clipboard.value) {
                        try {
                            clipboard.select();
                            clipboard.setSelectionRange(
                                0,
                                clipboard.textLength
                            );
                            document.execCommand("copy");
                            copied = true;
                        } catch (e) {}
                    }
                    if (copied) {
                        var error_div =
                            document.getElementById("clipboard_error");
                        error_div &&
                            (error_div.innerText =
                                "Clipboard copied sucessfully") &&
                            error_div.removeAttribute("hidden");
                    } else {
                        var error_div =
                            document.getElementById("clipboard_error");
                        error_div &&
                            (error_div.innerText =
                                "There was an error copying the clipboard") &&
                            error_div.removeAttribute("hidden");
                    }
                });
                $("#clipboard_export_btn").click(async () => {
                    var json = await cdh_copy_paste.readClipboard(
                            "cdh_clipboard"
                        ),
                        blob = new Blob([json], { type: "octet/stream" }),
                        a = document.createElement("a");
                    url = window.URL.createObjectURL(blob);
                    a.href = url;
                    a.download = `CDH Clipboard - ${gApp.inMemoryModels.account}_${gApp.inMemoryModels.profile}.txt`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                });
            },
            start: async function () {
                this.getQualifiedId();
                this.storage.initialized.then(async function () {
                    var imported = await cdh_copy_paste.readClipboard(
                        "cdh_clipboard"
                    );
                    if (imported) {
                        try {
                            this.clipboard = JSON.parse(
                                decodeURIComponent(escape(atob(imported)))
                            );
                            this.clipboard.eventspecs =
                                this.clipboard.eventspecs || {};
                        } catch (e) {}
                    }
                });
            },
        };

        cdh_copy_paste.start();

        // Listener for attribute pages

        window.addEventListener(
            "hashchange",
            (event) => {
                var old_plat = event.oldURL.match(/\#.*?-stream\//) || [];
                var new_plat = event.newURL.match(/\#.*?-stream\//) || [];
                if (
                    (event.newURL.indexOf("/attributes") > -1 &&
                        !document.getElementById("view_clipboard") &&
                        (event.oldURL.indexOf("/attributes") == -1 ||
                            old_plat[0] != new_plat[0])) ||
                    (event.newURL.indexOf("#event-feeds") > -1 &&
                        event.oldURL.indexOf("#event-feeds") == -1) ||
                    (event.newURL.indexOf("#audiences") > -1 &&
                        event.oldURL.indexOf("#audiences") == -1) ||
                    (event.newURL.indexOf("#home") > -1 &&
                        event.oldURL.indexOf("#home") == -1) ||
                    (event.newURL.indexOf("/actions") > -1 &&
                        !document.getElementById("view_clipboard") &&
                        (event.oldURL.indexOf("/actions") == -1 ||
                            old_plat[0] != new_plat[0]))
                ) {
                    if (document.location.hash == "#home") {
                        $(`<div class="dsc-panel-header">
            <button class="btn btn-info" id="view_clipboard" data-test="paste-attribute-button" style="margin-right: 5px;"><i class="fa fa-clipboard mr-1"></i>View Clipboard</button>
            </div>`).insertBefore("div.dsc-panel-header");
                    }

                    if (event.newURL.indexOf("/attributes") > -1) {
                        cdh_copy_paste.current_page = "attribute";
                        /* Platform update added these for us
            jQuery(
              '<input style="float:left;" class="att_select" type="checkbox">'
            ).insertBefore(
              ".as-accordion-header, .quantifier-accordion-placeholder"
            );
            */
                    }
                    if (event.newURL.indexOf("#audiences") > -1) {
                        cdh_copy_paste.current_page = "audience";
                        jQuery(
                            '<input style="float:left;" class="att_select" type="checkbox">'
                        ).insertBefore(
                            ".as-accordion-header, .audience-accordion-placeholder"
                        );
                    }
                    if (event.newURL.indexOf("#event-feeds") > -1) {
                        cdh_copy_paste.current_page = "event-feed";
                        jQuery(
                            '<input style="float:left;" class="att_select" type="checkbox">'
                        ).insertBefore(
                            ".as-accordion-header, .audience-accordion-placeholder"
                        );
                    }
                    if (event.newURL.indexOf("/actions") > -1) {
                        cdh_copy_paste.current_page = "connector";
                    }
                    if (cdh_copy_paste.current_page == "connector") {
                        jQuery(
                            '<button class="btn btn-warning" id="copy_connectors" data-test="copy-attribute-button" style="margin-right: 5px;"><i class="far fa-copy mr-1"></i>Copy Connectors & Actions</button>'
                        ).insertBefore(
                            'button[data-test="add-' +
                                cdh_copy_paste.current_page +
                                '-button"]'
                        );
                    }
                    if (cdh_copy_paste.current_page !== "connector") {
                        jQuery(
                            '<button class="btn btn-warning" id="copy_button" data-test="copy-attribute-button" style="margin-right: 5px;"><i class="far fa-copy mr-1"></i>Copy Selected</button>'
                        ).insertBefore(
                            'button[data-test="add-' +
                                cdh_copy_paste.current_page +
                                '-button"]'
                        );
                    }
                    /* old buttons
          jQuery(
            '<button class="btn btn-info" id="paste_button" data-test="paste-attribute-button" style="margin-right: 5px;"><i class="fa fa-clipboard mr-1"></i>Paste Clipboard</button>'
          ).insertBefore(
            'button[data-test="add-' + cdh_copy_paste.current_page + '-button"]'
          );
          */
                    jQuery(
                        '<button class="btn btn-info" id="view_clipboard" data-test="paste-attribute-button" style="margin-right: 5px;"><i class="fa fa-clipboard mr-1"></i>View Clipboard</button>'
                    ).insertBefore(
                        'button[data-test="add-' +
                            cdh_copy_paste.current_page +
                            '-button"]'
                    );
                    /* old buttons
          jQuery(
            '<button class="btn btn-default" id="edit_button" data-test="edit-clipboard-button" style="margin-right: 5px;"><i class="far fa-pencil mr-1"></i>Edit Clipboard</button>'
          ).insertBefore(
            'button[data-test="add-' + cdh_copy_paste.current_page + '-button"]'
          );
          jQuery(
            '<button class="btn btn-danger" id="delete_button" data-test="delete-clipboard-button" style="margin-right: 5px;"><i class="far fa-trash-alt mr-1"></i>Empty Clipboard</button>'
          ).insertBefore(
            'button[data-test="add-' + cdh_copy_paste.current_page + '-button"]'
          );
          */


                    getAllSelected = async function () {
                        cdh_copy_paste.getQualifiedId();
                        var items_added = false;
                        // if on attributes
                        if (cdh_copy_paste.current_page == "attribute") {
                            // copy attributes logic here
			/* This got broken by a platform update
			    var showAllId = document.querySelector('label[title="Show All"]').attributes['for'].value;
			    var selector = `input[id="${showAllId}"]`;

			    document.querySelector(selector).click();
			*/
			    jQuery('div.list-group-item:contains(Show All) input')?.[0]?.click()
                            const ATTR_UPDATES = 90;
                            const NUM_CONTEXT_ATTRS = Number(document.querySelector('div[class^="quantifiers_filter_display__StyledNumOfAttrContainer"]').innerText.split(' ')[0]);
                            const NUM_SELECTED_ATTRS = Number(document.querySelector('div[data-test="quantifier_accordion_list_filter"]')?.innerText.split(' ')[0]);

                            if (!NUM_SELECTED_ATTRS) {
                                alert("No attributes selected");
                                return;
                            }

                        const container = document.querySelector('#esQuantifiersContainer > .tab-content') || document.querySelector('#asQuantifiersContainer > .tab-content');
                        const oldHeight = container.style.height;

                        let heightInt = Number(oldHeight.match(/(\d+)px/)[1]),
                            totalAttrs = 0,
                            firstTime = true;

                        const interval = setInterval(() => {
                            const numAttrs = document.querySelectorAll('#bulkEditAttribute').length,
                                //numChecked = document.querySelectorAll('input[data-test^="quantifier_"]:checked').length;
                                numChecked = document.querySelectorAll('input#bulkEditAttribute:checked').length;

                            console.log(`Number of attrs loaded: ${numAttrs}/${NUM_CONTEXT_ATTRS} | Number of checked: ${numChecked}/${NUM_SELECTED_ATTRS}`);

                            if (numAttrs === NUM_CONTEXT_ATTRS || numChecked === NUM_SELECTED_ATTRS) {
                                clearInterval(interval);
                                container.style.height = oldHeight;
                                console.log('%cDONE', 'color:green');
                                //document.querySelectorAll('input[data-test^="quantifier_"]:checked').forEach(a=>{
                                document.querySelectorAll("input[name='bulkEditAttribute']:checked").forEach(a=>{
                                    // var qid = a.parentElement.attributes["data-track-action"]?.value || "";
                                    // var id_match = qid.match(/audience-stream-(\d*?)-/) || [];
                                    // var id = id_match[1];
                                    var id = a.closest('.as-accordion-instance').attributes["data-id"]?.value || "";
                                    if (id) {
                                        window.cdh_copy_paste.copyAttribute(id);
                                        items_added = true;
                                        a.checked = false;
                                        a.parentElement.classList.add("checked");
                                        a.parentElement.classList.add("disabled");
                                    }
                                });

                                //
                                window.cdh_copy_paste.clipboard = JSON.parse(
                                    JSON.stringify( window.cdh_copy_paste.clipboard)
                                );
                                window.cdh_copy_paste.clipboard.eventspecs = window.cdh_copy_paste.clipboard.eventspecs || {};

                                cdh_copy_paste.saveClipboard(
                                "cdh_clipboard",
                                window.cdh_copy_paste.clipboard
                            ).then(()=>alert("Attributes added to clipboard"));
                            }
                            const attrsIncreasedByUpdates = numAttrs >= totalAttrs + ATTR_UPDATES;
                            if (firstTime || attrsIncreasedByUpdates) {
                                heightInt += (55 * ATTR_UPDATES);
                                container.style.height = `${heightInt}px`;
                                totalAttrs = attrsIncreasedByUpdates ? numAttrs : totalAttrs;
                                firstTime = false;
                            }

                        }, 250);
                        } else {
                            jQuery("input.att_select:checked").each(
                                async (i, e) => {
                                    var target =
                                        e.parentElement || jQuery(e).next();

                                    console.log(target, i);
                                    //var value = target?.attributes['data-id']?.value || jQuery(e)?.next()?.attributes['data-id']?.value;
                                    var value =
                                        target?.attributes["data-id"]?.value ||
                                        jQuery(e)?.next()?.[0]?.attributes?.[
                                            "data-id"
                                        ]?.value;
                                    if (value) {
                                        if (
                                            cdh_copy_paste.current_page ==
                                            "attribute"
                                        ) {
                                            window.cdh_copy_paste.copyAttribute(
                                                value
                                            );
                                        }
                                        if (
                                            cdh_copy_paste.current_page ==
                                            "audience"
                                        ) {
                                            window.cdh_copy_paste.copyAudience(
                                                value
                                            );
                                        }
                                        if (
                                            cdh_copy_paste.current_page ==
                                            "event-feed"
                                        ) {
                                            window.cdh_copy_paste.copyEventFeed(
                                                value
                                            );
                                        }
                                        // show its already been copied
                                        e.checked = false;
                                        e.indeterminate = true;
                                        items_added = true;
                                    }
                                }
                            );
                        }
                        if (items_added) {
                            window.cdh_copy_paste.clipboard = JSON.parse(
                                JSON.stringify(window.cdh_copy_paste.clipboard)
                            );
                            window.cdh_copy_paste.clipboard.eventspecs =
                                window.cdh_copy_paste.clipboard.eventspecs ||
                                {};
                            /*window.localStorage.setItem(
                "cdh_clipboard",
                btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
              );*/
                            await cdh_copy_paste.saveClipboard(
                                "cdh_clipboard",
                                window.cdh_copy_paste.clipboard
                            );
                            // alert("items added to clipboard");
                        } else if (
                            cdh_copy_paste.current_page !== "attribute" &&
                            !items_added
                        ) {
                            alert("no items copied to the clipboard");
                        }

                    };

                    jQuery("#copy_button").click(getAllSelected);
                    jQuery("#view_clipboard").click(
                        cdh_copy_paste.viewClipboard
                    );
                    //#region old button listeners
                    jQuery("#paste_button").click(
                        cdh_copy_paste.processClipboard
                    );
                    jQuery("#delete_button").click(async () => {
                        window.cdh_copy_paste.clipboard = {
                            eventspecs: {},
                            eventfeeds: {},
                            audiences: {},
                            attributes: {},
                            enrichments: {},
                            rules: {},
                            connectors: {},
                            actions: {},
                        };
                        jQuery("input.att_select:checked").each((i, e) => {
                            e.checked = false;
                            e.indeterminate = false;
                        });
                        /*window.localStorage.setItem(
              "cdh_clipboard",
              btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
            );
            */
                        (await cdh_copy_paste.saveClipboard(
                            "cdh_clipboard",
                            window.cdh_copy_paste.clipboard
                        ))
                            ? alert("clipboard has been emptied")
                            : "";

                        alert("clipboard has been emptied");
                    });
                    jQuery("#edit_button").click(async () => {
                        var current_clipboard =
                            (await cdh_copy_paste.readClipboard(
                                "cdh_clipboard"
                            )) || "";
                        //current_clipboard = current_clipboard ? atob(current_clipboard) : "";
                        var clipboardModal = new gApp.views.SimpleModalView({
                            model: new Backbone.Model({
                                title: "Clipboard",
                                hideCancel: true,
                                message: `<style> textarea {
              width: 100%;
              -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
              -moz-box-sizing: border-box;    /* Firefox, other Gecko */
              box-sizing: border-box;         /* Opera/IE 8+ */
            }</style>
            <textarea id='popup_clipboard' rows="10">${current_clipboard}</textarea><br>
            <p hidden id='clipboard_error'> There was an error importing the clipboard </p>`,
                                buttons: [
                                    {
                                        id: "clipboard_close",
                                        text: "Close",
                                        location: "left",
                                        handler: () => {
                                            gApp.utils.modal.hide();
                                            if (
                                                gApp.app["modalTier2"] &&
                                                gApp.app["modalTier2"]
                                                    .currentView
                                            ) {
                                                gApp.app[
                                                    "modalTier2"
                                                ].cleanUp();
                                                cdh_copy_paste.viewClipboard();
                                            }
                                        },
                                    },
                                ],
                            }),
                        });
                        gApp.utils.modal.show(clipboardModal);
                        $(
                            '<div id="clipboard_import_btn" class="btn-modal-action btn btn-default clickable modalButton d-flex ml-auto" data-test="default_simple_modal_action_btn">Import</div>'
                        ).insertBefore(
                            'div[data-test="default_simple_modal_action_btn"]'
                        );
                        $("#clipboard_import_btn").click(async () => {
                            var updated = false;
                            var clipboard =
                                document.getElementById("popup_clipboard");
                            if (clipboard && clipboard.value) {
                                try {
                                    cdh_copy_paste.clipboard = JSON.parse(
                                        clipboard.value
                                    );
                                    /*window.localStorage.setItem(
                          "cdh_clipboard",
                          btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
                        );
                        */
                                    updated =
                                        await cdh_copy_paste.saveClipboard(
                                            "cdh_clipboard",
                                            window.cdh_copy_paste.clipboard
                                        );
                                } catch (e) {
                                    try {
                                        cdh_copy_paste.clipboard = JSON.parse(
                                            decodeURIComponent(
                                                escape(atob(clipboard.value))
                                            )
                                        );
                                        /*window.localStorage.setItem(
                          "cdh_clipboard",
                          btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
                        );
                        */
                                        updated =
                                            await cdh_copy_paste.saveClipboard(
                                                "cdh_clipboard",
                                                window.cdh_copy_paste.clipboard
                                            );
                                    } catch (e) {}
                                }
                            }
                            if (updated) {
                                gApp.utils.modal.hide();
                                if (
                                    gApp.app["modalTier2"] &&
                                    gApp.app["modalTier2"].currentView
                                ) {
                                    gApp.app["modalTier2"].cleanUp();
                                }
                            } else {
                                var error_div =
                                    document.getElementById("clipboard_error");
                                error_div &&
                                    error_div.removeAttribute("hidden");
                            }
                        });

                        $("#clipboard_export_btn").click(async () => {
                            var json = btoa(
                                    unescape(
                                        encodeURIComponent(
                                            JSON.stringify(
                                                await readClipboard(
                                                    "cdh_clipboard"
                                                )
                                            )
                                        )
                                    )
                                ),
                                blob = new Blob([json], {
                                    type: "octet/stream",
                                }),
                                a = document.createElement("a");
                            url = window.URL.createObjectURL(blob);
                            a.href = url;
                            a.download = "CDH Clipboard";
                            a.click();
                            window.URL.revokeObjectURL(url);
                        });
                    });
                    //#endregion
                    jQuery("#copy_connectors").click(() => {
                        //connector / actions modal

                        var connectorModal = new gApp.views.SimpleModalView({
                            model: new Backbone.Model({
                                title: "Connectors & Actions",
                                hideCancel: true,
                                message: `<style> select {
                      height: auto !important;
                      width: 45%;
                      -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
                      -moz-box-sizing: border-box;    /* Firefox, other Gecko */
                      box-sizing: border-box;         /* Opera/IE 8+ */
                    }</style>
                  
                  <select id='popup_connectors' multiple size="10">
                  </select>
                  <select id='popup_actions' multiple size="10">

                  </select>
                  <p hidden id='connectors_error'> There was an error copying connectors</p>`,
                                buttons: [
                                    {
                                        id: "connectors_close",
                                        text: "Close",
                                        location: "left",
                                        handler: () => {
                                            gApp.utils.modal.hide();
                                            if (
                                                gApp.app["modalTier2"] &&
                                                gApp.app["modalTier2"]
                                                    .currentView
                                            ) {
                                                gApp.app[
                                                    "modalTier2"
                                                ].cleanUp();
                                            }
                                        },
                                    },
                                ],
                            }),
                        });
                        connectorModal.el.className =
                            connectorModal.el.className.replace(
                                "modal-xs",
                                "modal-md"
                            );
                        connectorModal.el.setAttribute(
                            "ccp-id",
                            "copy_connectors_view"
                        );
                        gApp.utils.modal.show(connectorModal);
                        var conns = _store.connectors.visibleItems.map((e) => {
                            return { name: e.name, id: e.id, type: e.type };
                        });
                        for (let i = 0; i < conns.length; i++) {
                            var conn = conns[i];
                            if (conn.type !== "tealium_cloud_functions") {
                                var option = document.createElement("option");
                                option.value = conn.id;
                                option.text = `${
                                    conn.name
                                } (${conn.type.replace("_", " ")})`;
                                $("#popup_connectors").append(option);
                            }
                        }
                        $("#popup_connectors").change(function () {
                            if (
                                $("#popup_connectors option:checked").length ==
                                1
                            ) {
                                var selected_id = $(
                                    "#popup_connectors option:checked"
                                )[0].value;
                                var actions =
                                    _store.actions.visibleItems.filter(
                                        (e) => e.connectorId == selected_id
                                    );

                                var select =
                                    document.getElementById("popup_actions");
                                for (
                                    let i = select.options.length - 1;
                                    i >= 0;
                                    i--
                                ) {
                                    select.options[i] = null;
                                }

                                for (let i = 0; i < actions.length; i++) {
                                    var act = actions[i];
                                    var option =
                                        document.createElement("option");
                                    option.value = act.id;
                                    option.text = act.name;
                                    $("#popup_actions").append(option);
                                }
                                $("#popup_actions")[0].disabled = false;
                            } else if (
                                $("#popup_connectors option:checked").length > 1
                            ) {
                                var select =
                                    document.getElementById("popup_actions");
                                for (
                                    let i = select.options.length - 1;
                                    i >= 0;
                                    i--
                                ) {
                                    select.options[i] = null;
                                }
                                var option = document.createElement("option");
                                option.value = 0;
                                option.text = "All actions";
                                option.selected = true;
                                $("#popup_actions").append(option);
                                $("#popup_actions")[0].disabled = true;
                            }
                        });
                        $(`<div id="select_all" class="btn-modal-action btn btn-default clickable modalButton d-flex mr-auto" style="margin-right: 10px !important;" data-test="default_simple_modal_action_btn">Select All</div>
                <div id="unselect_all" class="btn-modal-action btn btn-default clickable modalButton d-flex mr-auto" style="margin-right: 10px !important;" data-test="default_simple_modal_action_btn">Unselect All</div>
                <div id="copy_button" class="btn-modal-action btn btn-default clickable modalButton d-flex mr-auto" data-test="default_simple_modal_action_btn">Add to Clipboard</div>`).insertBefore(
                            'div[ccp-id="copy_connectors_view"] > div > div[data-test="default_simple_modal_action_btn"]'
                        );

                        $("#select_all").on("click", function () {
                            $("#popup_connectors option").each(function (e) {
                                this.selected = true;
                            });
                            var select =
                                document.getElementById("popup_actions");
                            for (
                                let i = select.options.length - 1;
                                i >= 0;
                                i--
                            ) {
                                select.options[i] = null;
                            }
                            var option = document.createElement("option");
                            option.value = 0;
                            option.text = "All actions";
                            option.selected = true;
                            $("#popup_actions").append(option);
                            $("#popup_actions")[0].disabled = true;
                        });
                        $("#unselect_all").on("click", function () {
                            $("#popup_connectors option").each(function (e) {
                                this.selected = false;
                            });
                            var select =
                                document.getElementById("popup_actions");
                            for (
                                let i = select.options.length - 1;
                                i >= 0;
                                i--
                            ) {
                                select.options[i] = null;
                            }
                        });
                        $("#copy_button").on("click", async function () {
                            cdh_copy_paste.getQualifiedId();
                            var cons = $("#popup_connectors option:checked");
                            var all_cons = $("#popup_connectors option");
                            var obj = { connectors: [] };
                            for (let i = 0; i < cons.length; i++) {
                                obj.connectors.push(cons[i].value);
                            }
                            if (
                                cons.length == 1 &&
                                cons.length != all_cons.length
                            ) {
                                // one connector, for specified actions;
                                var actions = $(
                                    "#popup_actions option:checked"
                                );
                                obj.actions = [];
                                for (let i = 0; i < actions.length; i++) {
                                    obj.actions.push(actions[i].value);
                                }
                            }

                            //debugger
                            // If actions is defined, we only want those.
                            // If no actions - import all actions the connector has
                            var added = false;
                            if (obj.actions) {
                                for (let i = 0; i < obj.actions.length; i++) {
                                    cdh_copy_paste.copyAction(obj.actions[i]);
                                    added = true;
                                }
                            } else {
                                for (
                                    let i = 0;
                                    i < obj.connectors.length;
                                    i++
                                ) {
                                    var actions =
                                        _store.actions.visibleItems.filter(
                                            (e) =>
                                                e.connectorId ==
                                                obj.connectors[i]
                                        );
                                    for (let j = 0; j < actions.length; j++) {
                                        cdh_copy_paste.copyAction(
                                            actions[j].id
                                        );
                                        added = true;
                                    }
                                }
                            }

                            if (window.cdh_copy_paste.clipboard) {
                                window.cdh_copy_paste.clipboard = JSON.parse(
                                    JSON.stringify(
                                        window.cdh_copy_paste.clipboard
                                    )
                                );
                                /*
                        window.localStorage.setItem(
                          "cdh_clipboard",
                          btoa(unescape(encodeURIComponent(JSON.stringify(window.cdh_copy_paste.clipboard))))
                        );
                        */
                                updated = await cdh_copy_paste.saveClipboard(
                                    "cdh_clipboard",
                                    window.cdh_copy_paste.clipboard
                                );
                                added
                                    ? alert("items added to clipboard")
                                    : alert(
                                          "No items added to clipboard - Please select something!"
                                      );
                            } else {
                                alert("no items detected in clipboard");
                            }
                        });
                    });
                }
            },
            false
        );
        var old_hash = window.location.hash;
        window.location.hash = "#";
        window.location.hash = old_hash;

        // hide stupid select labels
        var css = document.createElement("style");
        css.innerText = `div.quantifiers_filter_display__StyledFilterDisplayContainer-ntnp4w-0 {
      display:none
                  }`;
        document.head.append(css);
    }
    $(document.body).on("click", ".list-group-item", () => {
        setTimeout(cdh_copy_paste.addCheckboxes, 500);
    });
}
tealiumTools.send(window.cdh_copy_paste.message);
