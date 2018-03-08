/* global Function, DIV, io */

let wg = {
	pages: {
		DEFAULT: {
			title: "Not found",
			render(root, page) {
				root.append(DIV("error").text(`Page '${page}' not found.`));
			}
		}
	},

	goto(page, current) {

		if (current) {
			history.replaceState(page, page, page);
		} else {
			history.pushState(page, page, page);
		}

		let params = {};

		if (page.startsWith("/")) {
			page = page.slice(1);
		}

		if (!page || page === "") {
			page = "home";
		}

		let qmPos = page.indexOf("?");
		if (qmPos !== -1) {
			let vars = page.slice(qmPos + 1).split('&');
			vars.forEach(avar => {
				let pair = avar.split('=');
				if (pair.length === 2) {
					params[pair[0]] = decodeURIComponent(pair[1]);
				}
			});
			page = page.slice(0, qmPos);
		}

		let root = $("body");
		root.empty();
		let p = this.pages[page] || this.pages.DEFAULT;

		console.info("Rendering", page, params);
		document.title = p.title || page;
		p.render(root, page, params);
	}
};

function startWebglue() {

	console.info("Webglue application starting...");

	/**** tag factories ****/

	function createFactory(fncName, htmlTag) {
		window[fncName] = (...args) => {
			let el = $(`<${htmlTag}>`);
			args.forEach(arg => {
				if (arg instanceof Array) {
					el.append(arg);
				} else if (arg instanceof Function) {
					arg(el);
				} else if (arg instanceof Object) {
					el.attr(arg);
				} else if (typeof arg === "string") {
					el.addClass(arg);
				}
			});
			return el;
		};
	}

	createFactory("DIV", "div");
	createFactory("SPAN", "span");
	createFactory("H1", "h1");
	createFactory("H2", "h2");
	createFactory("H3", "h3");
	createFactory("AHREF", "a");
	createFactory("BUTTON", "button");
	createFactory("LABEL", "label");
	createFactory("PAR", "p");
	createFactory("SETOFF", "i");
	createFactory("FORM", "form");
	createFactory("SELECT", "select");
	createFactory("OPTION", "option");
	createFactory("INPUT", "input");
	createFactory("TEXT", 'input type="text"');
	createFactory("PASSWORD", "input type='password'");
	createFactory("NUMBER", 'input type="number"');
	createFactory("CHECKBOX", 'input type="checkbox"');
	createFactory("TEXTAREA", "textarea");
	createFactory("TABLE", "table");
	createFactory("TR", "tr");
	createFactory("TD", "td");

	/**** navigation ****/

	$(document).on("click", "a", e => {
		let page = $(e.currentTarget).attr("href");
		if (!page.startsWith("http") && !page.startsWith("blob")) {
			e.preventDefault();
			let page = $(e.currentTarget).attr("href");
			wg.goto(page);
		}
	});

	window.onpopstate = e => {
		if (e.state) {
			wg.goto(e.state, true);
		}
	};

	/**** server connection ****/

	const url = `${location.protocol.replace("http", "ws")}//${location.host}`;

	const socket = io.connect(url);

	socket.on("event", (eventName, args) => {
		console.info("->", eventName, args);
		$("*").trigger("webglue." + eventName, args);
	});

	socket.on("connect", () => {

		socket.emit("discover", "1.0", info => {

			console.info("Server discovery", info);

			for (let apiName in info.api) {
				wg[apiName] = {};
				for (let fncName in info.api[apiName]) {
					wg[apiName][fncName] = async function (...args) {
						return new Promise((resolveCall, rejectCall) => {
							socket.emit("call", {
								api: apiName,
								fnc: fncName,
								args
							}, reply => {
								if (reply.error) {
									rejectCall(reply.error);
								} else {
									resolveCall(reply.result);
								}
							});
						});

					};
				}
			}

			setInterval(() => {
				$("*").trigger("webglue.Heartbeat");
			}, 1000);

			info.events.push("Heartbeat");

			info.events.forEach(eventName => {
				$.fn["on" + eventName.charAt(0).toUpperCase() + eventName.slice(1)] = function (handler) {
					this.on("webglue." + eventName, (e, ...args) => {
						if (e.currentTarget === e.target) {
							handler.apply(handler, args);
						}
					});
					return this;
				};
			});

			wg.goto(window.location.pathname + window.location.search, true);
		});

	});

}