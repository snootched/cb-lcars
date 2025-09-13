/**
 * Data Source Manager - Handles data source resolution and entity data fetching
 */

export class DataSourceManager {
  static getEntityDataForSparkline(dataSource) {
    if (!dataSource) return null;

    console.log(`[DataSourceManager] Looking for data source: ${dataSource}`);

    // Try to get real entity data
    const actualEntityId = this.resolveDataSourceToEntity(dataSource);
    const entityRuntime = window.__msdDebug?.entities;

    if (entityRuntime && actualEntityId) {
      const entity = entityRuntime.get(actualEntityId);
      if (entity && entity.state) {
        const currentValue = parseFloat(entity.state);
        if (!isNaN(currentValue)) {
          console.log(`[DataSourceManager] ✅ Found real entity data for ${actualEntityId}: ${currentValue}`);
          return this.generateRealisticTimeSeries(actualEntityId, currentValue);
        }
      }
    }

    // Fallback to demo data
    console.log(`[DataSourceManager] Using demo data for: ${dataSource}`);
    return this.generateDemoDataForSparkline(dataSource);
  }

  static resolveDataSourceToEntity(dataSource) {
    try {
      const merged = window.__msdDebug?.pipeline?.merged;
      if (merged?.data_sources?.[dataSource]) {
        return merged.data_sources[dataSource].entity;
      }
      return dataSource;
    } catch (e) {
      return dataSource;
    }
  }

  static generateRealisticTimeSeries(entityId, currentValue) {
    const now = Date.now();
    const timeSeries = [];
    const entityType = this.getEntityVariationType(entityId);

    for (let i = 0; i < 24; i++) {
      const minutesAgo = i * 5;
      const timestamp = now - (minutesAgo * 60000);

      let historicalValue;
      switch (entityType) {
        case 'battery':
          historicalValue = currentValue + (Math.random() * 2 - 1) + (minutesAgo * 0.01);
          historicalValue = Math.max(0, Math.min(100, historicalValue));
          break;
        case 'temperature':
          const tempCycle = Math.sin((minutesAgo / 60) * Math.PI / 12) * 3;
          historicalValue = currentValue + tempCycle + (Math.random() * 1.5 - 0.75);
          break;
        default:
          historicalValue = currentValue + (Math.random() * 4 - 2);
          break;
      }

      timeSeries.unshift({
        timestamp: timestamp,
        value: Math.round(historicalValue * 100) / 100
      });
    }

    return timeSeries;
  }

  static getEntityVariationType(entityId) {
    const id = entityId.toLowerCase();
    if (id.includes('battery') || id.includes('batt')) return 'battery';
    if (id.includes('temp') || id.includes('temperature')) return 'temperature';
    if (id.includes('humid')) return 'humidity';
    return 'generic';
  }

  static generateDemoDataForSparkline(overlayId) {
    const now = Date.now();
    const demoData = [];
    const baseValue = overlayId.includes('cpu') ? 45 :
                     overlayId.includes('memory') ? 60 :
                     overlayId.includes('temp') ? 72 : 50;

    for (let i = 0; i < 20; i++) {
      const timeOffset = i * 0.5;
      const sineWave = Math.sin(timeOffset) * 15;
      const noise = (Math.random() - 0.5) * 8;

      demoData.push({
        timestamp: now - (19 - i) * 60000,
        value: Math.max(5, Math.min(95, baseValue + sineWave + noise))
      });
    }

    return demoData;
  }
}
