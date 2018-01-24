function applyGaStatus()
{
	var isOptOut = localStorage.getItem("gastatus") == "optout";
	window['ga-disable-UA-36266608-3'] = isOptOut;
	document.getElementById("gaoptout").checked = isOptOut;
}
// Start GA
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://ssl.google-analytics.com/analytics.js','ga');
// First thing first, has the user optout in the past?
applyGaStatus();
ga('create', 'UA-36266608-3', 'auto');
ga('set', 'checkProtocolTask', null);
ga('send', 'pageview');
// This script is run everytime we click the extension
function clickBrowserAction(tab)
{
	// The user wants us to runs on this page, asks the user dynamically for permission and then reload the page
	var url = tab.url;
	var schemeEnd = url.indexOf('://');
	var siteEnd = url.indexOf('/', schemeEnd+3);
	var originRequest = url.substring(0, siteEnd+1) + "*";
	// Ask for permission then immediately notify the background that we are want to enable this tab
	// On Chrome the popup dies before the permission grant arrives
	chrome.permissions.request({origins:[originRequest]}, function(granted) {});
	chrome.runtime.sendMessage({type: "enableOnTab", tabId: tab.id, origin: originRequest});
}
function gotTab(tabs)
{
	// Notify the background that we want to enable on this page
	clickBrowserAction(tabs[0]);
}
function enableCJ()
{
	ga('send', 'event', 'PopupUI', 'enable');
	chrome.tabs.query({active:true, currentWindow: true}, gotTab);
}
function sendReport()
{
	// Check what's the current report phase
	if(this.value == "Report bug")
	{
		ga('send', 'event', 'PopupUI', 'reportopen');
		chrome.tabs.query({active:true, currentWindow: true}, function(tabs)
		{
			document.getElementById("reporturl").textContent = tabs[0].url;
			document.getElementById("report").style.display = "block";
			document.getElementById("reportbutton").value = "Send report";
		});
	}
	else
	{
		ga('send', 'event', 'PopupUI', 'reportsend');
		var xhr = new XMLHttpRequest()
		xhr.open("POST","https://docs.google.com/forms/d/e/1FAIpQLSeH7R7wTYq-ocOsANoYwbbHPXiFYwd289g4B5S4k5e2Z-V7Zg/formResponse")
		// Google forms does not provide CORS, but we actually don't care
		xhr.onerror=function()
		{
			document.getElementById("reportbutton").value = "Sent!";
			document.getElementById("reportbutton").disabled = true;
			document.getElementById("report").style.display = "none";
		};
		var url = document.getElementById("reporturl").textContent;
		var message = document.getElementById("reportmsg").value;
		xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		xhr.send("entry.18291016=" + encodeURIComponent(url) + "&entry.1779831778=" + encodeURIComponent(message));
	}
}
function toggleSettings()
{
	ga('send', 'event', 'PopupUI', 'settings');
	var settingsDiv = document.getElementById("settings");
	var curDisplay = settingsDiv.style.display;
	if(curDisplay == "none")
		settingsDiv.style.display = "block";
	else
		settingsDiv.style.display = "none";
}
function toggleGaStatus()
{
	ga('send', 'event', 'PopupUI', 'gaoptout');
	if(localStorage.getItem("gastatus") == "optout")
		localStorage.setItem("gastatus", "enabled");
	else
		localStorage.setItem("gastatus", "optout");
	applyGaStatus();
}
document.getElementById("enablebutton").addEventListener("click", enableCJ);
document.getElementById("reportbutton").addEventListener("click", sendReport);
document.getElementById("settingsbutton").addEventListener("click", toggleSettings);
document.getElementById("gaoptout").addEventListener("click", toggleGaStatus);
