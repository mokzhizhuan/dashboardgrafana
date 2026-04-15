from bacpypes.core import run
from bacpypes.task import RecurringTask
from bacpypes.app import BIPSimpleApplication
from bacpypes.object import AnalogValueObject, BinaryValueObject
from bacpypes.local.device import LocalDeviceObject
from bacpypes.service.object import ReadWritePropertyMultipleServices
from bacpypes.service.cov import ChangeOfValueServices
from bacpypes.basetypes import EngineeringUnits
from bacpypes.primitivedata import Real, Boolean
from bacpypes.consolelogging import ConfigArgumentParser


class SimulatorApplication(
    BIPSimpleApplication,
    ReadWritePropertyMultipleServices,
    ChangeOfValueServices,
):
    pass


class ValueUpdater(RecurringTask):
    def __init__(self, interval_ms, temp_obj, hum_obj, fan_obj):
        super().__init__(interval_ms)
        self.temp_obj = temp_obj
        self.hum_obj = hum_obj
        self.fan_obj = fan_obj
        self.step = 0

    def process_task(self):
        self.step += 1

        temp = 24.0 + ((self.step % 10) * 0.1)
        hum = 60.0 + ((self.step % 5) * 0.5)
        fan = (self.step % 2 == 0)

        self.temp_obj.presentValue = Real(temp)
        self.hum_obj.presentValue = Real(hum)
        self.fan_obj.presentValue = Boolean(fan)

        print(f"Updated -> Temp: {temp:.1f}, Humidity: {hum:.1f}, Fan: {fan}")


def main():
    parser = ConfigArgumentParser(description="Simple BACnet/IP simulator")
    args = parser.parse_args()

    this_device = LocalDeviceObject(
        objectName="Demo_BACnet_Device",
        objectIdentifier=1001,
        maxApduLengthAccepted=1024,
        segmentationSupported="segmentedBoth",
        vendorIdentifier=15,
    )

    # address comes from bacnet.ini
    this_application = SimulatorApplication(this_device, args.ini.address)

    temp_obj = AnalogValueObject(
        objectIdentifier=("analogValue", 1),
        objectName="RoomTemp",
        presentValue=Real(24.5),
        units=EngineeringUnits("degreesCelsius"),
        description="Simulated room temperature",
    )

    hum_obj = AnalogValueObject(
        objectIdentifier=("analogValue", 2),
        objectName="Humidity",
        presentValue=Real(61.0),
        units=EngineeringUnits("percentRelativeHumidity"),
        description="Simulated room humidity",
    )

    fan_obj = BinaryValueObject(
        objectIdentifier=("binaryValue", 1),
        objectName="FanEnable",
        presentValue=Boolean(True),
        description="Simulated fan status",
    )

    this_application.add_object(temp_obj)
    this_application.add_object(hum_obj)
    this_application.add_object(fan_obj)

    updater = ValueUpdater(5000, temp_obj, hum_obj, fan_obj)
    updater.install_task()

    print("BACnet simulator started")
    print("Device Instance: 2001")
    print("Device Name: Demo_BACnet_Device")
    print("Address:", args.ini.address)
    print("Objects: RoomTemp, Humidity, FanEnable")

    run()


if __name__ == "__main__":
    main()