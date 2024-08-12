import { Plugin, TFile, TFolder, FrontMatterCache, Notice } from 'obsidian';
import { CardDAVClient, CardDAVContact } from './carddav-client';
import { CardDAVSyncSettingTab, CardDAVSyncSettings, DEFAULT_SETTINGS } from './settings';

export default class CardDAVSyncPlugin extends Plugin {
    settings: CardDAVSyncSettings;
    client: CardDAVClient;
    private syncIntervalId: number | null = null;

    async onload() {
        console.log('Loading CardDAV Sync Plugin');
        await this.loadSettings();
        this.client = new CardDAVClient(this.settings.serverUrl, this.settings.username, this.settings.password);

        this.addCommand({
            id: 'sync-carddav',
            name: 'Sync CardDAV contacts',
            callback: () => this.syncContacts()
        });

        this.addSettingTab(new CardDAVSyncSettingTab(this.app, this));
        this.restartSyncInterval();
        console.log('CardDAV Sync Plugin loaded');
    }

    async loadSettings() {
        console.log('Loading settings');
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        console.log('Settings loaded:', JSON.stringify(this.settings, (key, value) => key === 'password' ? '****' : value));
    }

    async saveSettings() {
        console.log('Saving settings');
        await this.saveData(this.settings);
        console.log('Settings saved');
    }

    async syncContacts() {
        console.log('Starting sync process');
        new Notice('Syncing contacts...');
        
        try {
            console.log('Fetching CardDAV contacts');
            const carddavContacts = await this.fetchCarddavContacts();
            console.log(`Fetched ${carddavContacts.length} CardDAV contacts`);
            
            console.log('Fetching Obsidian contacts');
            const obsidianContacts = await this.fetchObsidianContacts();
            console.log(`Fetched ${obsidianContacts.length} Obsidian contacts`);
            
            console.log('Syncing contacts data');
            await this.syncContactsData(carddavContacts, obsidianContacts);
            
            console.log('Sync completed successfully');
            new Notice('Sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
            new Notice(`Sync failed: ${error.message}`);
        }
    }

    async fetchCarddavContacts(): Promise<CardDAVContact[]> {
        console.log('Fetching contacts from CardDAV server');
        try {
            const contacts = await this.client.fetchContacts();
            console.log(`Successfully fetched ${contacts.length} contacts from CardDAV server`);
            return contacts;
        } catch (error) {
            console.error('Error fetching CardDAV contacts:', error);
            throw error;
        }
    }

    async fetchObsidianContacts(): Promise<{file: TFile, frontmatter: any}[]> {
        console.log(`Fetching Obsidian contacts from folder: ${this.settings.contactsPath}`);
        const contacts: {file: TFile, frontmatter: any}[] = [];
        
        // Ensure the contacts folder exists
        const folder = await this.getOrCreateFolder(this.settings.contactsPath);
        
        if (folder) {
            console.log('Contacts folder found or created');
            const files = folder.children;
            for (const file of files) {
                if (file instanceof TFile && file.extension === 'md') {
                    console.log(`Processing file: ${file.path}`);
                    const cache = this.app.metadataCache.getFileCache(file);
                    if (cache?.frontmatter && cache.frontmatter.tags && cache.frontmatter.tags.includes('contact')) {
                        console.log(`Contact found in file: ${file.path}`);
                        contacts.push({file, frontmatter: cache.frontmatter});
                    }
                }
            }
        } else {
            console.error("Failed to create or access contacts folder:", this.settings.contactsPath);
        }
        
        console.log(`Found ${contacts.length} Obsidian contacts`);
        return contacts;
    }

    async getOrCreateFolder(path: string): Promise<TFolder | null> {
        const folderExists = this.app.vault.getAbstractFileByPath(path);
        if (folderExists instanceof TFolder) {
            return folderExists;
        }

        console.log(`Creating folder: ${path}`);
        try {
            await this.app.vault.createFolder(path);
            const newFolder = this.app.vault.getAbstractFileByPath(path);
            if (newFolder instanceof TFolder) {
                console.log(`Folder created successfully: ${path}`);
                return newFolder;
            } else {
                console.error(`Failed to create folder: ${path}`);
                return null;
            }
        } catch (error) {
            console.error(`Error creating folder ${path}:`, error);
            return null;
        }
    }

    async syncContactsData(carddavContacts: CardDAVContact[], obsidianContacts: {file: TFile, frontmatter: any}[]) {
        console.log('Starting contact sync');
        for (const carddavContact of carddavContacts) {
            const obsidianContact = obsidianContacts.find(c => c.frontmatter.uid === carddavContact.uid);
            if (obsidianContact) {
                console.log(`Updating existing Obsidian contact: ${carddavContact.uid}`);
                await this.updateObsidianContact(obsidianContact.file, carddavContact);
            } else {
                console.log(`Creating new Obsidian contact: ${carddavContact.uid}`);
                await this.createObsidianContact(carddavContact);
            }
        }

        for (const obsidianContact of obsidianContacts) {
            console.log(`Processing Obsidian contact: ${obsidianContact.frontmatter.uid}`);
            const carddavContact = carddavContacts.find(c => c.uid === obsidianContact.frontmatter.uid);
            if (!carddavContact) {
                console.log(`Creating new CardDAV contact: ${obsidianContact.frontmatter.uid}`);
                await this.createCardDAVContact(obsidianContact);
            }
        }
        console.log('Contact sync completed');
    }

    async updateObsidianContact(file: TFile, contact: CardDAVContact) {
        console.log(`Updating Obsidian contact: ${contact.uid}`);
        try {
            const content = await this.app.vault.read(file);
            const updatedContent = this.updateFrontMatter(content, contact);
            await this.app.vault.modify(file, updatedContent);
            console.log(`Successfully updated Obsidian contact: ${contact.uid}`);
        } catch (error) {
            console.error(`Error updating Obsidian contact ${contact.uid}:`, error);
            throw error;
        }
    }

    async createObsidianContact(contact: CardDAVContact) {
        console.log(`Creating new Obsidian contact: ${contact.uid}`);
        try {
            const content = this.createFrontMatter(contact);
            const folderPath = this.settings.contactsPath;
            const folder = await this.getOrCreateFolder(folderPath);
            if (folder) {
                const filePath = `${folderPath}/${contact.fullName}.md`;
                await this.app.vault.create(filePath, content);
                console.log(`Successfully created Obsidian contact: ${contact.uid} at ${filePath}`);
            } else {
                throw new Error(`Failed to create or access folder: ${folderPath}`);
            }
        } catch (error) {
            console.error(`Error creating Obsidian contact ${contact.uid}:`, error);
            throw error;
        }
    }

    async createCardDAVContact(obsidianContact: {file: TFile, frontmatter: any}) {
        console.log(`Creating new CardDAV contact: ${obsidianContact.frontmatter.uid}`);
        try {
            const contact: CardDAVContact = {
                uid: obsidianContact.frontmatter.uid,
                fullName: obsidianContact.frontmatter.fullName,
                email: obsidianContact.frontmatter.email,
                phone: obsidianContact.frontmatter.phone
            };
            await this.client.updateContact(contact);
            console.log(`Successfully created CardDAV contact: ${contact.uid}`);
        } catch (error) {
            console.error(`Error creating CardDAV contact ${obsidianContact.frontmatter.uid}:`, error);
            throw error;
        }
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
        console.log('Restarting sync interval');
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
        if (this.settings.syncInterval > 0) {
            this.syncIntervalId = window.setInterval(() => {
                this.syncContacts();
            }, this.settings.syncInterval * 60 * 1000);
            console.log(`Sync interval set to ${this.settings.syncInterval} minutes`);
        } else {
            console.log('Automatic sync is disabled');
        }
    }

    onunload() {
        console.log('Unloading CardDAV Sync Plugin');
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
    }

    private updateFrontMatter(content: string, contact: CardDAVContact): string {
        console.log(`Updating front matter for contact: ${contact.uid}`);
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
    
        if (match) {
            const frontMatter = match[1];
            const updatedFrontMatter = frontMatter
                .replace(/^fullName:.*$/m, `fullName: ${contact.fullName}`)
                .replace(/^email:.*$/m, `email: ${contact.email || ''}`)
                .replace(/^phone:.*$/m, `phone: ${contact.phone || ''}`)
                .replace(/^organization:.*$/m, `organization: ${contact.organization || ''}`)
                .replace(/^title:.*$/m, `title: ${contact.title || ''}`)
                .replace(/^address:.*$/m, `address: ${contact.address || ''}`)
                .replace(/^birthday:.*$/m, `birthday: ${contact.birthday || ''}`)
                .replace(/^url:.*$/m, `url: ${contact.url || ''}`);
    
            return content.replace(frontMatterRegex, `---\n${updatedFrontMatter}\n---`);
        }
    
        console.warn(`No front matter found for contact: ${contact.uid}`);
        return content;
    }

    private createFrontMatter(contact: CardDAVContact): string {
        console.log(`Creating front matter for new contact: ${contact.uid}`);
        return `---
uid: ${contact.uid}
tags: contact
fullName: ${contact.fullName}
email: ${contact.email || ''}
phone: ${contact.phone || ''}
organization: ${contact.organization || ''}
title: ${contact.title || ''}
address: ${contact.address || ''}
birthday: ${contact.birthday || ''}
url: ${contact.url || ''}
---

# ${contact.fullName}
`;
    }
}
