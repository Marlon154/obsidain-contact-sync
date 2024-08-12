# Obsidian CardDAV Sync Plugin

## Overview

The Obsidian CardDAV Sync Plugin is a powerful tool that allows Obsidian users to synchronize their contacts from CardDAV servers directly into their Obsidian vault.
This plugin bridges the gap between your contact management system and your knowledge management system, enabling seamless integration of your personal and professional networks into your notes.

## Features

- **CardDAV Server Connection**: Securely connect to any CardDAV-compliant server.
- **Contact Synchronization**: Fetch and update contacts from your CardDAV server.
- **Obsidian Note Creation**: Automatically create or update notes for each contact in your Obsidian vault.
- **Periodic Sync**: Set up automatic synchronization at specified intervals.
- **Manual Sync**: Trigger synchronization manually whenever you need.

### Planed
- Customizable Note Format
- 2 way sync

## Configuration

After installation, you need to configure the plugin with your CardDAV server details:

1. Go to Settings > CardDAV Sync.
2. Enter your CardDAV server URL.
3. Provide your username and password. Note some interfaces (e.g. Nextcloud) do not need the username.
4. Set the sync interval (in minutes) if you want automatic synchronization.
5. Specify the folder where contact notes should be created/updated.


## Usage

### Manual Sync

1. Click on the CardDAV Sync icon in the left ribbon.
2. Choose "Sync Now" to start the synchronization process.


### Automatic Sync

Once configured, the plugin will automatically sync at the specified interval.

## Note Format

By default, contact notes are created with the information as property.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the Obsidian team for creating an amazing platform.
- This plugin uses the [ical.js](https://github.com/mozilla-comm/ical.js/) library for parsing vCard data.

## Disclaimer

This plugin is not officially associated with Obsidian. Use at your own risk. Backup your vault and contacts before use.