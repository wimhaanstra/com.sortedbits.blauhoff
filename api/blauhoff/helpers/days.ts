export const dayToBitIndex = (day: string): number => {
    switch (day) {
        case 'monday':
            return 1;
        case 'tuesday':
            return 2;
        case 'wednesday':
            return 3;
        case 'thursday':
            return 4;
        case 'friday':
            return 5;
        case 'saturday':
            return 6;
        case 'sunday':
            return 7;
    }
    return -1;
};
