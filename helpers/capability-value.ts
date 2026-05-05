export const normalizeCapabilityValue = (capabilityId: string, value: any): any => {
    if (capabilityId === 'status_text' || capabilityId.startsWith('status_text.')) {
        return value === undefined || value === null ? '' : String(value);
    }

    return value;
};
