# Choof remote config

Static operational configuration consumed by the Choof app through jsDelivr.

- `config.json` controls cache TTLs, direct upstream API routing, update thresholds and artifact cache versions.
- `rfi-place-ids.json` maps ViaggiaTreno station codes to RFI monitor place IDs.

Edit and validate the JSON files, then publish both the Git commit and the CDN purge in one step:

```sh
npm run publish:config -- "describe the config change"
```

Rebuild the public RFI mapping from the ViaggiaTreno and RFI public station catalogs with:

```sh
npm run build:rfi-place-ids
```
