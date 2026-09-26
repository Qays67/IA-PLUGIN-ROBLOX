"use strict";

/**
 * Génère XozHubAI.rbxmx à partir de XozHubAI.plugin.lua.
 * Le fichier .rbxmx s'importe dans Roblox Studio via « Insert from File… ».
 *
 *   node build-plugin.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "XozHubAI.plugin.lua");
const OUT = path.join(ROOT, "XozHubAI.rbxmx");

const SCRIPT_NAME = "XozHubAI";

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source introuvable : ${SRC}`);
    process.exit(1);
  }

  const lua = fs.readFileSync(SRC, "utf8");

  // Sécurité CDATA : on coupe toute occurrence de "]]>"
  const safe = lua.replace(/]]>/g, "]]]]><![CDATA[>");

  const xml = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
	<Item class="Script" referent="RBX0">
		<Properties>
			<string name="Name">${SCRIPT_NAME}</string>
			<bool name="Disabled">false</bool>
			<ProtectedString name="Source"><![CDATA[${safe}]]></ProtectedString>
		</Properties>
	</Item>
</roblox>
`;

  fs.writeFileSync(OUT, xml, "utf8");

  const kb = (Buffer.byteLength(xml, "utf8") / 1024).toFixed(1);
  console.log(`✔ ${path.relative(ROOT, OUT)} généré (${kb} Ko)`);
  console.log("  Roblox Studio → clic droit dans l'Explorer → Insert from File… → Save as Local Plugin");
}

main();
