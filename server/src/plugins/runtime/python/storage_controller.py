from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Literal, overload

from plugins.runtime.python.storage import DeviceStorage
from plugins.runtime.python.store import CameraLocation, PluginLocation, SensorLocation

if TYPE_CHECKING:
    from _camera_ui_tools.camera_ui_rpc import RPCClient
    from _camera_ui_tools.camera_ui_sdk import JsonSchema
    from plugins.runtime.python.config_db import PluginConfigDb
    from plugins.runtime.python.plugin_api import PluginAPI
    from plugins.runtime.python.typings import PluginInfo


def sensor_storage_key(sensor_id: str) -> str:
    return f"sensor:{sensor_id}"


class StorageController:
    def __init__(
        self,
        api: PluginAPI,
        proxy: RPCClient,
        plugin: PluginInfo,
        plugin_db: PluginConfigDb,
    ) -> None:
        self.__api: PluginAPI = api
        self.__proxy = proxy
        self.__plugin = plugin
        self.__storages: dict[str, DeviceStorage] = {}
        self.__plugin_db = plugin_db

    def createCameraStorage(self, cameraId: str, schemas: list[JsonSchema] | None = []) -> DeviceStorage:
        if schemas is None:
            schemas = []

        camera_storage = self.__storages.get(cameraId)

        if not camera_storage:
            camera_storage = DeviceStorage(
                self.__api,
                self.__proxy,
                self.__plugin,
                self.__plugin_db,
                CameraLocation(camera_id=cameraId),
                schemas,
            )
            self.__storages[cameraId] = camera_storage
        elif schemas:
            camera_storage.update_schema(schemas)

        return camera_storage

    def createPluginStorage(self, schemas: list[JsonSchema] | None = []) -> DeviceStorage:
        if schemas is None:
            schemas = []

        plugin_storage = self.__storages.get("storage")

        if not plugin_storage:
            plugin_storage = DeviceStorage(
                self.__api,
                self.__proxy,
                self.__plugin,
                self.__plugin_db,
                PluginLocation(),
                schemas,
            )
            self.__storages["storage"] = plugin_storage
        elif schemas:
            plugin_storage.update_schema(schemas)

        return plugin_storage

    def getCameraStorage(self, camera_id: str) -> DeviceStorage | None:
        return self.__storages.get(camera_id)

    def getPluginStorage(self) -> DeviceStorage | None:
        return self.__storages.get("storage")

    def createSensorStorage(
        self,
        plugin_id: str,
        sensor_id: str,
        schemas: list[JsonSchema] = [],
    ) -> DeviceStorage:
        storage_key = sensor_storage_key(sensor_id)
        storage = self.__storages.get(storage_key)

        if not storage:
            storage = DeviceStorage(
                self.__api,
                self.__proxy,
                self.__plugin,
                self.__plugin_db,
                SensorLocation(sensor_id=sensor_id),
                schemas,
                sensor_id,
            )
            self.__storages[storage_key] = storage
        elif schemas:
            storage.update_schema(schemas)

        return storage

    def getSensorStorage(self, sensor_id: str) -> DeviceStorage | None:
        return self.__storages.get(sensor_storage_key(sensor_id))

    @overload
    async def createStorage(self, type_: Literal["camera"], device_id: str) -> DeviceStorage: ...
    @overload
    async def createStorage(self, type_: Literal["plugin"], device_id: None = None) -> DeviceStorage: ...
    @overload
    async def createStorage(
        self,
        type_: Literal["sensor"],
        device_id: str,  # plugin_id
        sensor_id: str = ...,
    ) -> DeviceStorage: ...
    async def createStorage(
        self,
        type_: Literal["camera", "plugin", "sensor"],
        device_id: str | None = None,  # camera_id or plugin_id
        sensor_id: str | None = None,
    ) -> DeviceStorage:
        storage: DeviceStorage | None = None

        if type_ == "camera":
            if not device_id:
                raise ValueError("ID is required for storage creation")

            storage = self.createCameraStorage(device_id)
        elif type_ == "sensor":
            if not device_id or not sensor_id:
                raise ValueError("pluginId and sensorId are required for sensor storage creation")

            storage = self.createSensorStorage(device_id, sensor_id)
        else:
            storage = self.createPluginStorage()

        await storage.register_storage()
        return storage

    async def releaseCameraStorage(self, camera_id: str) -> None:
        device_storage = self.__storages.get(camera_id)
        if device_storage:
            await device_storage.unregister_storage()

    # Internal method to close all storages
    async def close(self) -> None:
        storages = list(self.__storages.values())
        # saves share one config document and run in order, the handler drains overlap
        for storage in storages:
            try:
                await storage.save()
            except Exception as error:
                self.__api.logger.error(f"store: close save failed: {error}")
        results = await asyncio.gather(
            *[storage.unregister_storage() for storage in storages], return_exceptions=True
        )
        for result in results:
            if isinstance(result, Exception):
                self.__api.logger.error(f"store: close unregister failed: {result}")
        self.__storages.clear()
