var applets = document.querySelectorAll('applet,object[name=BankIDClient]');
var applets_rx = document.body.innerHTML.match(/(<(applet)[^>]*?>|<(object)[^>]*?>)/gim);

console.log(applets);

if (applets.length > 0) {
    for (var i = 0; i < applets.length; i++) {
        var doc = document.createDocumentFragment();

        var applet = applets[i];
        var applet_str = applets_rx[i];

        var object = document.createElement('object');
        var embed = document.createElement('embed');
        var params = document.querySelectorAll('param');

        // Nasty regex function for parsing the applet's attributes
        // and transfer them to the object element
        var attrs_str = applet_str.match(/(\w+)=("[^<>"]*"|'[^<>']*'|\w+)/gmi);
        for (var x = 0; x < attrs_str.length; x++) {
            var att = attrs_str[x].match(/(\w+)=("[^<>"]*"|'[^<>']*'|\w+)/);
            object.setAttribute(att[1], att[2].replace(/^["']{1}|["']{1}$/g, ''));
            embed.setAttribute(att[1], att[2].replace(/^["']{1}|["']{1}$/g, ''));
        }

        // Make sure we set type="application/x-java-applet"
        // otherwise the applet won't load
        if (!object.getAttribute('type'))
            object.setAttribute('type', 'application/x-java-applet');
        object.style.zIndex = '1000';

        // Find correct params for this applet
        for (var x = 0; x < params.length; x++) {
            if (params[x].parentNode === applet) {
                var par = document.createElement('param');
                par.setAttribute('name', params[x].name);
                par.setAttribute('value', params[x].value);

                doc.appendChild(par);
            }
        }
        object.appendChild(doc);

        // Get parent tag type
        if (applet_str.match(/<object/i)) {
            var parent_tag = document.documentElement.innerHTML
                .match(/<([a-z]+)[^>]*?>[^<>]*<object[^>]*>/im)[1];
        }
        else {
            var parent_tag = document.documentElement.innerHTML
                .match(/<([a-z]+)[^>]*?>[^<>]*<applet[^>]*>/im)[1];
        }
        var tags = document.querySelectorAll(parent_tag);
        
        // Loop through all same elements in DOM and compare child nodes
        for (var y = 0; y < tags.length; y++) {
            var children = tags[y].childNodes;
            for (var z = 0; z < children.length; z++) {
                if (children[z] === applet)
                    var parent = tags[y];
            }
        }

        // Remove <applet> and append <object>
        parent.removeChild(applet);
        parent.appendChild(object);
    }
}
