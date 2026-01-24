const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist_new');
const pub = path.join(__dirname, '..', 'public');

// Copy core files to dist and root
const root = path.join(__dirname, '..');
for (const f of ['plugin.json', 'preload.cjs', 'logo.png']) {
    const src = path.join(pub, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(dist, f));
        // Also copy to root for spark-master local development recognition
        fs.copyFileSync(src, path.join(root, f));
    }
}

// Read plugin.json metadata
const pluginConfig = JSON.parse(fs.readFileSync(path.join(pub, 'plugin.json'), 'utf-8'));

// Generate dist/package.json synced with plugin.json
const pkgContent = {
    name: pluginConfig.name,
    pluginName: pluginConfig.pluginName,
    version: pluginConfig.version,
    description: pluginConfig.description,
    main: pluginConfig.main || 'index.html',
    preload: pluginConfig.preload || 'preload.cjs',
    logo: pluginConfig.logo || 'logo.png',
    pluginType: pluginConfig.pluginType || 'ui',
    features: pluginConfig.features || []
};

fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(pkgContent, null, 2));
console.log('Postbuild complete: Metadata synced to dist/package.json');
