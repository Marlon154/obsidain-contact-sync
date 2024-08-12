import ICAL from 'ical.js';
import { requestUrl, RequestUrlResponse } from 'obsidian';

export interface CardDAVContact {
    uid: string;
    fullName: string;
    email: string;
    phone: string;
    organization?: string;
    title?: string;
    address?: string;
    birthday?: string;
    url?: string;
}

export class CardDAVClient {
    constructor(private serverUrl: string, private username: string, private password: string) {}

    async testConnection(): Promise<void> {
        console.log("Testing connection...");
        try {
            const response = await this.makeRequest('PROPFIND', this.serverUrl, {
                Depth: '0',
                'Content-Type': 'application/xml; charset=utf-8'
            });
            
            if (response.status === 207) {
                console.log("Connection test successful");
                return;
            } else {
                throw new Error(`Unexpected status code: ${response.status}`);
            }
        } catch (error) {
            console.error("Connection test failed:", error);
            throw error;
        }
    }

    async fetchContacts(): Promise<CardDAVContact[]> {
        console.log("Fetching contacts from:", this.serverUrl);
        
        try {
            const response = await this.makeRequest('PROPFIND', this.serverUrl, {
                Depth: '1',
                'Content-Type': 'application/xml; charset=utf-8'
            });

            console.log("PROPFIND response:", response.status);

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.text, "text/xml");
            const vcardUrls = Array.from(xmlDoc.getElementsByTagName('d:href')).map(node => node.textContent);

            console.log("Found vCard URLs:", vcardUrls.length);

            const contacts: CardDAVContact[] = [];

            for (const url of vcardUrls) {
                if (url && !url.endsWith('/')) {  // Skip collection URLs
                    console.log("Fetching vCard:", url);
                    const vcardResponse = await this.makeRequest('GET', this.getFullUrl(url));
                    const vcardData = vcardResponse.text;
                    const contact = this.parseVCard(vcardData);
                    if (contact) {
                        contacts.push(contact);
                    }
                }
            }

            console.log("Total contacts fetched:", contacts.length);
            return contacts;
        } catch (error) {
            console.error("Error fetching contacts:", error);
            throw error;
        }
    }

    private parseVCard(vcardData: string): CardDAVContact | null {
        try {
            const jCal = ICAL.parse(vcardData);
            const vCard = new ICAL.Component(jCal);
    
            const uid = vCard.getFirstPropertyValue('uid');
            const fullName = vCard.getFirstPropertyValue('fn');
            const email = vCard.getFirstPropertyValue('email');
            const phone = vCard.getFirstPropertyValue('tel');
            const organization = vCard.getFirstPropertyValue('org');
            const title = vCard.getFirstPropertyValue('title');
            const address = vCard.getFirstPropertyValue('adr');
            const birthdayProp = vCard.getFirstProperty('bday');
            const url = vCard.getFirstPropertyValue('url');
    
            if (!uid || !fullName) return null;
    
            console.log(birthdayProp.toString());
            let birthday: string | undefined;
            if (birthdayProp) {
                const birthdayValue = birthdayProp.getFirstValue();
                if (birthdayValue instanceof ICAL.Time) {
                    // If it's an ICAL.Time object, format it as YYYY-MM-DD
                    birthday = `${birthdayValue.year.toString().padStart(4, '0')}-${
                        (birthdayValue.month).toString().padStart(2, '0')}-${
                        birthdayValue.day.toString().padStart(2, '0')}`;
                } else if (typeof birthdayValue === 'string') {
                    // If it's a string, try to parse it
                    const parts = birthdayValue.split('-');
                    if (parts.length === 3) {
                        // Full date: YYYY-MM-DD
                        birthday = birthdayValue;
                    } else if (parts.length === 2) {
                        // Month and day only: --MM-DD
                        birthday = `xxxx-${parts[0]}-${parts[1]}`;
                    }
                }
            }
    
            const formatField = (field: string | string[] | undefined): string => {
                if (Array.isArray(field)) {
                    const nonEmptyValues = field.filter(v => v && v.trim() !== '');
                    return nonEmptyValues.length > 0 ? nonEmptyValues.join(', ') : "";
                }
                return field && field.trim() !== '' ? field : "";
            };
                
            return { 
                uid, 
                fullName, 
                email, 
                phone, 
                organization: formatField(organization),
                title,
                address: formatField(address),
                birthday,
                url
            };
        } catch (error) {
            console.error("Error parsing vCard:", error, "Raw data:", vcardData);
            return null;
        }
    }

    private async makeRequest(method: string, url: string, headers: Record<string, string> = {}): Promise<RequestUrlResponse> {
        console.log(`Making ${method} request to:`, url);
        try {
            const response = await requestUrl({
                url: url,
                method: method,
                headers: {
                    'Authorization': 'Basic ' + btoa(this.username + ':' + this.password),
                    ...headers
                }
            });
            console.log(`Response status:`, response.status);
            return response;
        } catch (error) {
            console.error(`Error in ${method} request:`, error);
            throw error;
        }
    }

    async updateContact(contact: CardDAVContact): Promise<void> {
        console.log("Updating contact:", contact.uid);
        const vCard = new ICAL.Component(['vcard', [], []]);
        vCard.addPropertyWithValue('uid', contact.uid);
        vCard.addPropertyWithValue('fn', contact.fullName);
        if (contact.email) vCard.addPropertyWithValue('email', contact.email);
        if (contact.phone) vCard.addPropertyWithValue('tel', contact.phone);

        const vcardString = vCard.toString();
/**
        await this.makeRequest('PUT', this.getFullUrl(`${contact.uid}.vcf`), {
            'Content-Type': 'text/vcard; charset=utf-8'
        });
 */
    }

    private getFullUrl(path: string): string {
        const baseUrl = new URL(this.serverUrl);
        return new URL(path, baseUrl).toString();
    }
}
