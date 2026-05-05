import { normalizeCapabilityValue } from '../capability-value';

describe('capability value normalization', () => {
    test('converts status_text capability values to strings', () => {
        expect(normalizeCapabilityValue('status_text.run_mode', 2)).toBe('2');
        expect(normalizeCapabilityValue('status_text', 2)).toBe('2');
        expect(normalizeCapabilityValue('status_text.sell_solar', 'Yes')).toBe('Yes');
    });

    test('leaves other capability values unchanged', () => {
        expect(normalizeCapabilityValue('measure_power.load', 123)).toBe(123);
        expect(normalizeCapabilityValue('readable_boolean.device_status', true)).toBe(true);
    });
});
