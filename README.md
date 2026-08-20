# BlauHoff

Adds Homey support for BlauHoff hybrid inverters and BlauHoff BLH-5100 home batteries. Packs that are already linked to CFE Group through the Smart Energy PLAT cloud can be added with that same account.

![Workflow](https://github.com/sorted-bits/com.sortedbits.blauhoff/actions/workflows/node.js.yml/badge.svg)

## Supported devices

### Hybrid inverters

The following inverters are supported through both a Modbus connection or using a Solarman Wifi dongle.

1. [Deye Sun \*K SG01HP3 EU AM2 Series](repositories/device-repository/devices/deye/sun-xk-sg01hp3-eu-am2/README.md)
2. [Afore AF XK-TH Three Phase Hybrid Inverter](repositories/device-repository/devices/afore/af-xk-th-three-phase-hybrid/README.md)

Currently the app also supports two Growatt inverters **using Modbus**.

1. [Growatt 1PH MIC TL-X series](repositories/device-repository/devices/growatt/growatt-tl/README.md)
2. [Growatt 3PH MOD TL3-X series](repositories/device-repository/devices/growatt/growatt-tl3/README.md)

### Home batteries (CFE Group / Smart Energy PLAT)

BlauHoff **BLH-5100** home batteries are supported through the CFE Group **Smart Energy PLAT** cloud. If a pack is already added in the Smart Energy PLAT app (barcode scan and Wi-Fi setup), Homey can list it after you sign in with that same account.

Other batteries on the same CFE Group Smart Energy PLAT platform can be added the same way, so you do not need a separate local Modbus or Solarman connection for these packs.

### Solarman

A lot of inverters already come with some sort of Wifi-dongle. For the devices mentioned above, we made it possible to directly connect Homey to the Solarman Wifi dongle itself, using the internal IP address of the dongle.

This allows us to read and write to the inverter, without using a cloud connection, which makes it more stable, but also allows for data to be read more often.

### Modbus

When you want to use the Modbus connection, you need a device like the [Waveshare RS232/RS485 to POE ETH](<https://www.waveshare.com/wiki/RS232_RS485_TO_POE_ETH_(B)>). We tested the linked the device and had a nice experience with it. The linked version supports Power over Ethernet which allows you to just run a single ethernet wire to it.

### Fixed IP address

Because there is no way to discover either a Modbus adapter OR an Solarman dongle on the network, you need to specify an IP address during the pairing process. It is recommended to give your device a static IP address, so it will not change, for example with a power outage.

### Installation

Currently only the test version of the app is up-to-date for usage with Modbus, Solarman, and Smart Energy PLAT batteries.

1. Visit [the installation page here](https://homey.app/a/com.sortedbits.blauhoff/test/).
2. Click the big green **`Install App`** button that appears on the page.
3. If you are not logged in, into your Homey account, please log in.
4. The website will ask you, which Homey to install to, please select the correct Homey.
5. Click on the huge **`Install App`** button again.
6. A message will appear that notifies you, that the app will be installed on your Homey.

#### In Homey

After the app installed, there are a couple more steps you need to complete to add your BlauHoff device to Homey.

#### Hybrid inverter

1. Press the **`+`** button to add a new device.
2. From the list that is shown, choose **`BlauHoff`**.
3. Choose **`BlauHoff Hybrid Inverter`** from the list.
4. Choose **`Connect`** from the popup that appears.
5. During the connection process, you need to select the brand of device you have. Either Deye or Afore, select the brand and click **`Next`**.
6. You should now choose which **model** of device you have. Select it and click **`Next`**.
7. The **`Connection Type`** screen lets you select between a Solarman or a Modbus connection. Choose what type of connection you need to your device and click **`Next`**.
8. In the next screen, you should fill out your device details:
    1. Host, the IP address of either your Modbus adapter or your Solarman dongle.
    2. Port, for Modbus this usually is **`502`**, for your Solarman dongle **`8899`**.
    3. Unit ID, this is the Modbus slave ID, normally this is **`1`**.
    4. If you have chosen to use a Solarman connection, you need to fill in the Solarman dongle serial number.
9. Click **`Connect`**.
10. If your device is succesfully found, you can select it in the next screen and click **`Continue`**.

#### Smart Energy PLAT battery

Use this path for a BlauHoff BLH-5100, or for another battery that is already connected to CFE Group in the Smart Energy PLAT app.

1. Press the **`+`** button to add a new device.
2. From the list that is shown, choose **`BlauHoff`**.
3. Choose **`Smart Energy PLAT battery`**.
4. Set the pack up in the Smart Energy PLAT app first if you have not already (account, barcode, Wi-Fi).
5. Sign in with the same Smart Energy PLAT account.
6. Select one or more battery packs from the list and add them to Homey.

### Auto update

If you install the test version of the app, using the [Homey Store link](https://homey.app/a/com.sortedbits.blauhoff/test/) you will receive updates automatically once they are released.

## Other supported devices

During the development of the Modbus implementation, we used Growatt inverters to test reading data from a Modbus to ethernet connected device. These devices van still be used to read some basic properties.

1. [Growatt 1PH MIC TL-X series](repositories/device-repository/devices/growatt/growatt-tl/README.md)
2. [Growatt 3PH MOD TL3-X series](repositories/device-repository/devices/growatt/growatt-tl3/README.md)

## Adding support for more devices

Currently we only support limited devices, if you want to add support for more devices, there are a couple of things you need to do:

#### Add the device brand

If the device is of a new brand, which isn't included in the brands list yet, it should be added to the `Brand` enum. Update the [Brand.ts](https://github.com/sorted-bits/com.sortedbits.blauhoff/blob/91cc139cabd8e998db376726de3e3a4d58847611/repositories/device-repository/models/enum/brand.ts#L11) file.

#### Create a `DeviceInformation` class

In the folder `repositories/device-repository/devices/<brand>/<model>/` create a file called `<model>.ts`.

For example in the case of the `Afore AF XK-TH Three Phase Hybrid Inverter`, the file [`af-xk-th-three-phase-hybrid.ts`](https://github.com/sorted-bits/com.sortedbits.blauhoff/blob/main/repositories/device-repository/devices/afore/af-xk-th-three-phase-hybrid/af-xk-th-three-phase-hybrid.ts) is placed in `repositories/device-repository/devices/afore/af-xk-th-three-phase-hybrid/`

#### Input and Holding registers

While defining the `Input` and `Holding` registers, it is really important that you make sure both the lengths and datatype for each register is correct. This information is used to fetch the correct amount of bytes and this could cause wrong data to show up.
