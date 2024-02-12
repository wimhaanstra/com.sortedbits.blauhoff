import fs from 'fs';
import { devices } from '../../drivers/blauhoff-modbus/devices/devices';
import { orderModbusRegisters } from '../../drivers/blauhoff-modbus/helpers/order-modbus-registers';
import { brands } from '../../drivers/blauhoff-modbus/models/brand';
import { unitForCapability } from '../../drivers/blauhoff-modbus/helpers/units';

let output = '';

brands.forEach((brand) => {
    const models = devices.filter((device) => device.brand === brand);

    output += `# ${brand.toLocaleUpperCase()}\n`;
    models.forEach((model) => {
        output += `## ${model.name}\n`;
        output += `${model.description}\n\n`;

        const registers = model.getDefinition();

        output += '### Input Registers\n';
        output += '| Address | Length | Data Type | Unit | Scale | Capability ID |\n';
        output += '| ------- | ------ | --------- | ---- | ----- | ------------- |\n';
        orderModbusRegisters(registers.inputRegisters).forEach((register) => {
            const unit = unitForCapability(register.capabilityId);
            output += `| ${register.address} | ${register.length} | ${register.dataType.toString()} | ${unit} | ${register.scale} | ${register.capabilityId} |\n`;
        });

        output += '\n### Holding Registers\n';
        output += '| Address | Length | Data Type | Unit | Scale | Capability ID |\n';
        output += '| ------- | ------ | --------- | ---- |----- | ------------- |\n';
        orderModbusRegisters(registers.holdingRegisters).forEach((register) => {
            const unit = unitForCapability(register.capabilityId);
            output += `| ${register.address} | ${register.length} | ${register.dataType.toString()} | ${unit} | ${register.scale} | ${register.capabilityId} |\n`;
        });

        output += '\n';
    });
});

fs.writeFileSync('../../.build/modbus-registers.md', output);

const readme = fs.readFileSync('../../docs/README-template.md', 'utf8');

fs.writeFileSync('../../README.md', readme.replace('{{MODBUS_REGISTERS}}', output));
