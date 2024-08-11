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

        function parse(input: string): any[];
    }

    export default ICAL;
}