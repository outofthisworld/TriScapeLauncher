var pendingLoads=0;
function spoofFunc()
{
	// TODO: This is appropiate for newer Chrome
	if ('userAgent' in Navigator.prototype)
	{
		var oldUA = navigator.userAgent;
		var parts = oldUA.split(' ');
		for(var i=0;i<parts.length;i++)
		{
			// Replace with chromium, some sites have disabled chrome completely
			if(parts[i].startsWith("Chrome/") || parts[i].startsWith("Chromium/"))
				parts[i] = "Chromium/44";
		}
		var newUA = parts.join(' ');
		var mimes = [].slice.call(navigator.mimeTypes);
		mimes.push({description:"",type:"application/x-java-applet;version=1.8"});
		mimes.push({description:"",type:"application/x-java-applet;deploy=10.7.2"});
		Object.defineProperties(Navigator.prototype, {userAgent:{ value: newUA, configurable: false, enumerable: true, writable: false},
								javaEnabled: { value: function() { return true; }, configurable: false, enumerable: true, writable: false},
								mimeTypes: { value: mimes, configurable: false, enumerable: true, writable: false}});
	}
	else
		debugger
}
// Inject our code at the beginning of head, so we avoid messing up scripts that checks for the "last executed scripts"
function addScriptCode(code)
{
	var script = document.createElement("script");
	script.textContent = code;
	document.documentElement.insertBefore(script, document.documentElement.firstChild);
}
function addScriptFile(file, callback)
{
	var url = chrome.extension.getURL(file);
	var script = document.createElement("script");
	script.onload = callback;
	script.src = url;
	document.documentElement.insertBefore(script, document.documentElement.firstChild);
}
function addWebScriptFile(file, callback)
{
	if(document.head)
	{
		var script = document.createElement("script");
		script.onload = callback;
		script.src = file;
		script.crossOrigin = "anonymous";
		document.head.insertBefore(script, document.head.firstChild);
	}
	else
		window.addEventListener("DOMContentLoaded", function(){ addWebScriptFile(file, callback); });
}
function loaderReady()
{
	pendingLoads--;
	if(pendingLoads==0)
	{
		console.log("Applet init");
		var script = document.createElement("script");
		script.textContent = "cheerpjInit(/*isME*/false);";
		document.head.insertBefore(script, document.head.firstChild);
	}
}
function addCSS(file)
{
	var link = document.createElement("link");
	link.setAttribute("rel","stylesheet");
	link.setAttribute("type","text/css");
	link.setAttribute("href",file);
	link.setAttribute("media","screen");
	document.head.appendChild(link);
}
pendingLoads=1;
addScriptCode("("+spoofFunc.toString()+")()");
addWebScriptFile("https://cheerpjdeploy.leaningtech.com/loader.js", loaderReady);
//addWebScriptFile("https://cheerpjunstable.leaningtech.com/loader.js", loaderReady);
//addWebScriptFile("http://127.0.0.1:8090/loader.js", loaderReady);
