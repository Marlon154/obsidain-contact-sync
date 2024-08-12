declare module 'ical.js' {
    namespace ICAL {
        class Component {
            constructor(jCal: any[] | string);
            name: string;
            getFirstPropertyValue(name: string): string;
            getFirstProperty(name: string): Property;
            addPropertyWithValue(name: string, value: any): Property;
            toString(): string;
        }

        class Property {
            name: string;
            getFirstValue(): any;
            setParameter(name: string, value: string): void;
        }

        class Time {
            constructor(data?: {
                year?: number;
                month?: number;
                day?: number;
                hour?: number;
                minute?: number;
                second?: number;
                isDate?: boolean;
            });
            year: number;
            month: number;
            day: number;
            hour: number;
            minute: number;
            second: number;
            isDate: boolean;
            zone: Zone;

            toJSDate(): Date;
            toICALString(): string;
        }

        class Zone {
            tzid: string;
        }

        function parse(input: string): any[];
    }

    export default ICAL;
}