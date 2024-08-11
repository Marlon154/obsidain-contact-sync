import { App, PluginSettingTab, Setting, Notice, TextComponent } from 'obsidian';
import CardDAVSyncPlugin from './main';

export class CardDAVSyncSettingTab extends PluginSettingTab {
    plugin: CardDAVSyncPlugin;

    constructor(app: App, plugin: CardDAVSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'CardDAV Sync Settings'});

        new Setting(containerEl)
            .setName('CardDAV Server URL')
            .setDesc('Enter the URL of your CardDAV server')
            .addText(text => text
                .setPlaceholder('https://example.com/dav')
                .setValue(this.plugin.settings.serverUrl)
                .onChange(async (value) => {
                    this.plugin.settings.serverUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Username')
            .setDesc('Enter your CardDAV username')
            .addText(text => text
                .setPlaceholder('username')
                .setValue(this.plugin.settings.username)
                .onChange(async (value) => {
                    this.plugin.settings.username = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Password')
            .setDesc('Enter your CardDAV password')
            .addText(text => {
                (text as TextComponent).inputEl.type = 'password';
                text.setPlaceholder('password')
                    .setValue(this.plugin.settings.password)
                    .onChange(async (value) => {
                        this.plugin.settings.password = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('Set the interval for automatic sync (in minutes, 0 to disable)')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.syncInterval))
                .onChange(async (value) => {
                    const interval = parseInt(value, 10);
                    this.plugin.settings.syncInterval = isNaN(interval) ? 0 : interval;
                    await this.plugin.saveSettings();
                    this.plugin.restartSyncInterval();
                }));

        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Test the connection to your CardDAV server')
            .addButton(button => button
                .setButtonText('Test Connection')
                .onClick(async () => {
                    button.setButtonText('Testing...');
                    button.setDisabled(true);
                    try {
                        await this.plugin.testConnection();
                        new Notice('Connection successful!');
                    } catch (error) {
                        new Notice(`Connection failed: ${error.message}`);
                    } finally {
                        button.setButtonText('Test Connection');
                        button.setDisabled(false);
                    }
                }));
    }
}
