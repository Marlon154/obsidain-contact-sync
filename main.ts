import { Plugin, TFile, FrontMatterCache, Notice } from 'obsidian';
import { CardDAVClient, CardDAVContact } from './carddav-client';
import { CardDAVSyncSettingTab } from './settings';

interface CardDAVSyncSettings {
    serverUrl: string;
    username: string;
    password: string;
    syncInterval: number;
}

const DEFAULT_SETTINGS: CardDAVSyncSettings = {
    serverUrl: '',
    username: '',
    password: '',
    syncInterval: 30
}

export default class CardDAVSyncPlugin extends Plugin {
    settings: CardDAVSyncSettings;
    client: CardDAVClient;
    private syncIntervalId: number | null = null;

    async onload() {
        await this.loadSettings();
        this.client = new CardDAVClient(this.settings.serverUrl, this.settings.username, this.settings.password);

        this.addCommand({
            id: 'sync-carddav',
            name: 'Sync CardDAV contacts',
            callback: () => this.syncContacts()
        });

        this.addSettingTab(new CardDAVSyncSettingTab(this.app, this));
        this.restartSyncInterval();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async syncContacts() {
        console.log('Syncing contacts...');
        new Notice('Syncing contacts...');
        
        try {
            // 1. Fetch contacts from CardDAV server
            const carddavContacts = await this.fetchCarddavContacts();
            
            // 2. Fetch Obsidian notes with #contact tag
            const obsidianContacts = await this.fetchObsidianContacts();
            
            // 3. Compare and update
            await this.syncContactsData(carddavContacts, obsidianContacts);
            
            console.log('Sync completed');
            new Notice('Sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
            new Notice(`Sync failed: ${error.message}`);
        }
    }

    async fetchCarddavContacts(): Promise<CardDAVContact[]> {
        return this.client.fetchContacts();
    }

    async fetchObsidianContacts(): Promise<{file: TFile, frontmatter: any}[]> {
        const contacts: {file: TFile, frontmatter: any}[] = [];
        this.app.vault.getMarkdownFiles().forEach(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter && cache.frontmatter.tags && cache.frontmatter.tags.includes('contact')) {
                contacts.push({file, frontmatter: cache.frontmatter});
            }
        });
        console.log("Obsidian contacts found:", contacts.length);
        return contacts;
    }

    async syncContactsData(carddavContacts: CardDAVContact[], obsidianContacts: {file: TFile, frontmatter: any}[]) {
        for (const carddavContact of carddavContacts) {
            const obsidianContact = obsidianContacts.find(c => c.frontmatter.uid === carddavContact.uid);
            if (obsidianContact) {
                // Update existing contact
                await this.updateObsidianContact(obsidianContact.file, carddavContact);
            } else {
                // Create new contact
                await this.createObsidianContact(carddavContact);
            }
        }

        for (const obsidianContact of obsidianContacts) {
            const carddavContact = carddavContacts.find(c => c.uid === obsidianContact.frontmatter.uid);
            if (!carddavContact) {
                // Contact exists in Obsidian but not in CardDAV, create it in CardDAV
                await this.createCardDAVContact(obsidianContact);
            }
        }
    }

    async updateObsidianContact(file: TFile, contact: CardDAVContact) {
        console.log("Updating Obsidian contact:", contact.uid);
        const content = await this.app.vault.read(file);
        const updatedContent = this.updateFrontMatter(content, contact);
        await this.app.vault.modify(file, updatedContent);
    }

    async createObsidianContact(contact: CardDAVContact) {
        console.log("Creating new Obsidian contact:", contact.uid);
        const content = this.createFrontMatter(contact);
        await this.app.vault.create(`${contact.fullName}.md`, content);
    }

    async createCardDAVContact(obsidianContact: {file: TFile, frontmatter: any}) {
        console.log("Creating new CardDAV contact:", obsidianContact.frontmatter.uid);
        const contact: CardDAVContact = {
            uid: obsidianContact.frontmatter.uid,
            fullName: obsidianContact.frontmatter.fullName,
            email: obsidianContact.frontmatter.email,
            phone: obsidianContact.frontmatter.phone
        };
        await this.client.updateContact(contact);
    }

    async testConnection(): Promise<void> {
        console.log("Testing connection...");
        new Notice("Testing connection...");
        try {
            await this.client.testConnection();
            console.log("Connection test successful");
            new Notice("Connection test successful");
        } catch (error) {
            console.error("Connection test failed:", error);
            new Notice(`Connection test failed: ${error.message}`);
            throw error;
        }
    }

    restartSyncInterval(): void {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
        if (this.settings.syncInterval > 0) {
            this.syncIntervalId = window.setInterval(() => {
                this.syncContacts();
            }, this.settings.syncInterval * 60 * 1000);
            console.log(`Sync interval set to ${this.settings.syncInterval} minutes`);
        }
    }

    onunload() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
    }

    private updateFrontMatter(content: string, contact: CardDAVContact): string {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
    
        if (match) {
            const frontMatter = match[1];
            const updatedFrontMatter = frontMatter
                .replace(/^fullName:.*$/m, `fullName: ${contact.fullName}`)
                .replace(/^email:.*$/m, `email: ${contact.email || ''}`)
                .replace(/^phone:.*$/m, `phone: ${contact.phone || ''}`);
    
            return content.replace(frontMatterRegex, `---\n${updatedFrontMatter}\n---`);
        }
    
        return content;
    }

    private createFrontMatter(contact: CardDAVContact): string {
        return `---
uid: ${contact.uid}
tags: contact
fullName: ${contact.fullName}
email: ${contact.email || ''}
phone: ${contact.phone || ''}
---

# ${contact.fullName}
`;
    }
}
