/**
 * Counts the severities of controls.
 */

import {
  ChecklistFilter,
  ControlsFilter,
  filterCacheKey,
  FilteredData,
  FilteredDataModule
} from '@/store/data_filters';
import Store from '@/store/store';
import {Severity} from 'inspecjs';
import LRUCache from 'lru-cache';
import {getModule, Module, VuexModule} from 'vuex-module-decorators';

// The hash that we will generally be working with herein
type SeverityHash = {[key in Severity]: number};

// Helper function for counting a status in a list of controls
function count_severities(
  data: FilteredData,
  filter: ControlsFilter | ChecklistFilter
): SeverityHash {
  // Remove the status filter from the control filter
  const newFilter: ControlsFilter | ChecklistFilter = {
    status: [],
    ...filter
  };

  // Get the controls
  const controls = data.controls(newFilter);

  // Count 'em out
  const hash: SeverityHash = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };
  controls.forEach((c) => {
    const severity: Severity = c.root.hdf.severity;
    hash[severity] += 1;
  });

  // And we're done
  return hash;
}

@Module({
  namespaced: true,
  dynamic: true,
  store: Store,
  name: 'severityCounts'
})
export class SeverityCount extends VuexModule {
  /** Generates a hash mapping each status -> a count of its members */
  get hash(): (filter: ControlsFilter | ChecklistFilter) => SeverityHash {
    // Establish our cache and dependency
    const cache: LRUCache<string, SeverityHash> = new LRUCache({max: 30});

    return (filter: ControlsFilter | ChecklistFilter) => {
      const id = filterCacheKey(filter);
      const cached = cache.get(id);
      // If cache hits, just return
      if (cached !== undefined) {
        return cached;
      }

      // Elsewise, generate, cache, then return
      const result = count_severities(FilteredDataModule, filter);
      cache.set(id, result);
      return result;
    };
  }

  get none(): (filter: ControlsFilter | ChecklistFilter) => number {
    return (filter) => this.hash(filter)['none'];
  }

  get low(): (filter: ControlsFilter | ChecklistFilter) => number {
    return (filter) => this.hash(filter)['low'];
  }

  get medium(): (filter: ControlsFilter | ChecklistFilter) => number {
    return (filter) => this.hash(filter)['medium'];
  }

  get high(): (filter: ControlsFilter | ChecklistFilter) => number {
    return (filter) => this.hash(filter)['high'];
  }

  get critical(): (filter: ControlsFilter | ChecklistFilter) => number {
    return (filter) => this.hash(filter)['critical'];
  }
}

export const SeverityCountModule = getModule(SeverityCount);
