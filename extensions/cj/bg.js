var trackedTabs = [];
var spoofScript = "if ('userAgent' in Navigator.prototype){var oldValue = navigator.userAgent;var parts = oldValue.split(' ');for(var i=0;i<parts.length;i++){if(parts[i].startsWith('Chrome/'))parts[i]='Chrome/44';else if(parts[i].startsWith('Chromium/'))parts[i] = 'Chromium/44';}var newValue = parts.join(' ');Object.defineProperties(Navigator.prototype, {userAgent:{ value: newValue, configurable: false, enumerable: true, writable: false},javaEnabled: { value: function() { return true; }, configurable: false, enumerable: true, writable: false}});}else debugger";
function injectInCurrentTab(tabId, change)
{
	var tabIndex = trackedTabs.indexOf(tabId);
	if(tabIndex<0)
		return;
	trackedTabs.splice(tabIndex,1);
	// This is a race condition, but apparently can only be fixed by using blocking webRequest monitoring
	// TODO: Maybe we could replace "download" permission with "webRequests"
	if(change.status == "loading")
		chrome.tabs.executeScript(tabId, {file: "inject.js", runAt: "document_start"});
}
function originGranted(tabId)
{
	trackedTabs.push(tabId);
	chrome.tabs.reload(tabId);
}
function clickBrowserAction(tab)
{
	// The user wants us to runs on this page, asks the user dynamically for permission and then reload the page
	var url = tab.url;
	var schemeEnd = url.indexOf('://');
	var siteEnd = url.indexOf('/', schemeEnd+3);
	var originRequest = url.substring(0, siteEnd+1) + "*";
	chrome.permissions.request({origins:[originRequest]}, function(granted) {
		if(granted)
			originGranted(tab.id);
	});
}
function handleDownload(d)
{
	if(d.mime != "application/x-java-jnlp-file" || d.state!="in_progress")
		return;
	// Cancel the download and handle it manually
	chrome.downloads.cancel(d.id);
	chrome.windows.create({url:"jnlp.html?url="+encodeURIComponent(d.url),width:800,height:600});
}
// TODO: Remove closed tabs
chrome.tabs.onUpdated.addListener(injectInCurrentTab);
chrome.browserAction.onClicked.addListener(clickBrowserAction);
//chrome.downloads.onCreated.addListener(handleDownload);
// Make the icon active when there are obviously applets in the page
function setIconOnConditions(imgName, conditions)
{
	// Implementation is broken and we can't use path
	var image = new Image();
	image.onload = function() {
		var canvas = document.createElement("canvas");
		canvas.width = image.width;
		canvas.height = image.height;
		var ctx = canvas.getContext("2d");
		ctx.drawImage(image, 0, 0);
		var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
		chrome.declarativeContent.onPageChanged.addRules([
			{conditions: conditions,
			actions:[ new chrome.declarativeContent.SetIcon({imageData: imageData})]}
		]);
	};
	image.src = imgName;
}
chrome.runtime.onInstalled.addListener(function(details)
{
	chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
		setIconOnConditions("cheerpj.png", [
				// Match applet tags
				new chrome.declarativeContent.PageStateMatcher({css:["applet"]}),
				new chrome.declarativeContent.PageStateMatcher({css:["object[classid='clsid:8AD9C840-044E-11D1-B3E9-00805F499D93'"]})
				]);
		setIconOnConditions("cheerpj-tick.png", [
				// Match already rewritten cheerpj object
				new chrome.declarativeContent.PageStateMatcher({css:["object[data-cheerpj='']"]}),
				]);
	});
});
var pendingEnables = [];
function findPendingAndStart(grantedOrigin)
{
	// From last to first, so that splice does not break things
	for(var i=pendingEnables.length-1;i>=0;i--)
	{
		if(pendingEnables[i].origin == grantedOrigin)
			originGranted(pendingEnables[i].tabId);
		pendingEnables.splice(i,1);
	}
}
function messageHandler(m)
{
	if(m.type == "enableOnTab")
	{
		pendingEnables.push(m);
		var queryOrigin = m.origin;
		// Check if we have already permission for this origin
		chrome.permissions.contains({origins:[queryOrigin]},function(granted)
		{
			if(!granted)
				return;
			// Check if the request is still pending
			findPendingAndStart(queryOrigin);
		});
	}
}
function permissionAdded(p)
{
	var origins = p.origins;
	if(!origins)
		return;
	for(var i=0;i<origins.length;i++)
		findPendingAndStart(origins[i]);
}
chrome.runtime.onMessage.addListener(messageHandler);
chrome.permissions.onAdded.addListener(permissionAdded);
