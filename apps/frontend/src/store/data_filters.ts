/**
 * This module provides a cached, reusable method for filtering data from data_store.
 */

import { Trinary } from '@/enums/Trinary';
import { InspecDataModule } from '@/store/data_store';
import {
  FileID,
  SourcedContextualizedEvaluation,
  SourcedContextualizedProfile
} from '@/store/report_intake';
import Store from '@/store/store';
import {
  ChecklistAsset,
  ChecklistFile,
  ChecklistVuln
} from '@mitre/hdf-converters';
import {
  ContextualizedControl,
  ContextualizedProfile,
  ControlStatus,
  NistControl,
  Severity
} from 'inspecjs';
import _ from 'lodash';
import LRUCache from 'lru-cache';
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from 'vuex-module-decorators';
import { SearchModule } from './search';

const MAX_CACHE_ENTRIES = 20;

export declare type ExtendedControlStatus = ControlStatus | 'Waived';

/** Contains common filters on data from the store. */
export interface Filter {
  // General
  /** Which file these objects came from. Undefined => any */
  fromFile: FileID[];

  // Control specific
  /** What status the controls can have. Undefined => any */
  status?: ExtendedControlStatus[];

  /** What severity the controls can have. Undefined => any */
  severity?: Severity[];

  /** Whether or not to allow/include overlayed controls */
  omit_overlayed_controls?: boolean;

  /** Control IDs to search for */
  ids?: string[];

  /** Titles to search for */
  titleSearchTerms?: string[];

  /** Descriptions to search for */
  descriptionSearchTerms?: string[];

  /** Code to search for */
  codeSearchTerms?: string[];

  /** CCIs to search for */
  nistIdFilter?: string[];

  /** Ruleid to search for */
  ruleidSearchTerms?: string[];

  /** Vulid to search for */
  vulidSearchTerms?: string[];

  /** Stigid to search for */
  stigidSearchTerms?: string[];

  /** Classification to search for */
  classificationSearchTerms?: string[];

  /** Groupname to search for */
  groupNameSearchTerms?: string[];

  /** Checklist CCIs to search for */
  cciSearchTerms?: string[];

  /** A search term string, case insensitive
   * We look for this in
   * - control ID
   * - rule title
   * - severity
   * - status
   * - finding details (from HDF)
   * - code
   */
  searchTerm?: string;

  /** The current state of the Nist Treemap. Used to further filter by nist categories etc. */
  treeFilters?: TreeMapState;

  /** A specific control id */
  control_id?: string;
}

export type TreeMapState = string[]; // Representing the current path spec, from root

/**
 * Facillitates the search functionality
 * @param term The string to search with
 * @param contextControl The control to search for term in
 */
function contains_term(
  contextControl: ContextualizedControl,
  term: string
): boolean {
  const asHDF = contextControl.root.hdf;
  // Get our (non-null) searchable data
  const searchables: string[] = [
    asHDF.wraps.id,
    asHDF.wraps.title,
    asHDF.wraps.code,
    asHDF.severity,
    asHDF.status,
    asHDF.finding_details
  ].filter((s) => s !== null) as string[];

  // See if any contain term
  return searchables.some((s) => s.toLowerCase().includes(term));
}

@Module({
  namespaced: true,
  dynamic: true,
  store: Store,
  name: 'filteredData'
})
export class FilteredData extends VuexModule {
  selectedEvaluationIds: FileID[] = [];
  selectedProfileIds: FileID[] = [];
  selectedChecklistIds: FileID[] = [];

  /** For Checklist Viewer */
  readonly emptyRule: ChecklistVuln = {
    status: '',
    findingDetails: '',
    comments: '',
    severityOverride: '',
    severityJustification: '',
    vulnNum: '',
    severity: '',
    groupTitle: '',
    ruleId: '',
    ruleVersion: '',
    ruleTitle: '',
    vulnDiscuss: '',
    iaControls: '',
    checkContent: '',
    fixText: '',
    falsePositives: '',
    falseNegatives: '',
    documentable: '',
    mitigations: '',
    potentialImpact: '',
    thirdPartyTools: '',
    mitigationControl: '',
    responsibility: '',
    securityOverrideGuidance: '',
    checkContentRef: '',
    weight: '',
    class: '',
    stigRef: '',
    targetKey: '',
    stigUuid: '',
    legacyId: '',
    cciRef: ''
  };

  readonly emptyAsset: ChecklistAsset = {
    role: '',
    assettype: '',
    hostname: '',
    hostip: '',
    hostmac: '',
    hostfqdn: '',
    marking: '',
    targetcomment: '',
    techarea: '',
    targetkey: '',
    webordatabase: false,
    webdbsite: '',
    webdbinstance: ''
  };

  selectedRule: ChecklistVuln = this.emptyRule;

  @Mutation
  SELECT_EVALUATIONS(files: FileID[]): void {
    this.selectedEvaluationIds = [
      ...new Set([...files, ...this.selectedEvaluationIds])
    ];
  }

  @Mutation
  SELECT_PROFILES(files: FileID[]): void {
    this.selectedProfileIds = [
      ...new Set([...files, ...this.selectedProfileIds])
    ];
  }

  @Mutation
  SELECT_CHECKLIST(file: FileID): void {
    this.selectedChecklistIds = [file];
  }

  @Mutation
  SELECT_RULE(rule: ChecklistVuln): void {
    this.selectedRule = rule;
  }

  @Mutation
  CLEAR_EVALUATION(removeId: FileID): void {
    this.selectedEvaluationIds = this.selectedEvaluationIds.filter(
      (ids) => ids !== removeId
    );
  }

  @Mutation
  CLEAR_PROFILE(removeId: FileID): void {
    this.selectedProfileIds = this.selectedProfileIds.filter(
      (ids) => ids !== removeId
    );
  }

  @Mutation
  CLEAR_CHECKLIST(removeId: FileID): void {
    this.selectedChecklistIds = this.selectedChecklistIds.filter(
      (ids) => ids !== removeId
    );
  }

  @Mutation
  CLEAR_ALL_EVALUATIONS(): void {
    this.selectedEvaluationIds = [];
  }

  @Mutation
  CLEAR_ALL_PROFILES(): void {
    this.selectedProfileIds = [];
  }

  @Mutation
  CLEAR_ALL_CHECKLISTS(): void {
    this.selectedChecklistIds = [];
  }

  @Action
  public toggle_all_evaluations(): void {
    if (this.all_evaluations_selected === Trinary.On) {
      this.CLEAR_ALL_EVALUATIONS();
    } else {
      this.SELECT_EVALUATIONS(
        InspecDataModule.allEvaluationFiles.map((v) => v.uniqueId)
      );
    }
  }

  @Action
  public toggle_all_profiles(): void {
    if (this.all_profiles_selected === Trinary.On) {
      this.CLEAR_ALL_PROFILES();
    } else {
      this.SELECT_PROFILES(
        InspecDataModule.allProfileFiles.map((v) => v.uniqueId)
      );
    }
  }

  @Action
  public select_exclusive_evaluation(fileID: FileID): void {
    this.CLEAR_ALL_EVALUATIONS();
    this.SELECT_EVALUATIONS([fileID]);
  }

  @Action
  public select_exclusive_profile(fileID: FileID): void {
    this.CLEAR_ALL_PROFILES();
    this.SELECT_PROFILES([fileID]);
  }

  @Action
  public selectRule(rule: ChecklistVuln): void {
    this.SELECT_RULE(rule);
  }

  @Action
  public toggle_evaluation(fileID: FileID): void {
    if (this.selectedEvaluationIds.includes(fileID)) {
      this.CLEAR_EVALUATION(fileID);
    } else {
      this.SELECT_EVALUATIONS([fileID]);
    }
  }

  @Action
  public toggle_profile(fileID: FileID): void {
    if (this.selectedProfileIds.includes(fileID)) {
      this.CLEAR_PROFILE(fileID);
    } else {
      this.SELECT_PROFILES([fileID]);
    }
  }

  @Action
  public toggle_checklist(fileID: FileID): void {
    if (this.selectedChecklistIds.includes(fileID)) {
      this.CLEAR_CHECKLIST(fileID);
      this.SELECT_RULE(this.emptyRule);
    } else {
      this.SELECT_CHECKLIST(fileID);
    }
  }

  @Action
  public clear_file(fileID: FileID): void {
    this.CLEAR_EVALUATION(fileID);
    this.CLEAR_PROFILE(fileID);
    this.CLEAR_CHECKLIST(fileID);
  }

  /**
   * Parameterized getter.
   * Get all evaluations from the specified file ids
   */
  get evaluations(): (
    files: FileID[]
  ) => readonly SourcedContextualizedEvaluation[] {
    return (files: FileID[]) => {
      return InspecDataModule.contextualExecutions.filter((e) =>
        files.includes(e.from_file.uniqueId)
      );
    };
  }

  get profiles_for_evaluations(): (
    files: FileID[]
  ) => readonly ContextualizedProfile[] {
    return (files: FileID[]) => {
      // Filter to those that match our filter. In this case that just means come from the right file id
      return this.evaluations(files).flatMap(
        (evaluation) => evaluation.contains
      );
    };
  }

  /**
   * Parameterized getter.
   * Get all profiles from the specified file ids.
   */
  get profiles(): (files: FileID[]) => readonly SourcedContextualizedProfile[] {
    return (files: FileID[]) => {
      return InspecDataModule.contextualProfiles.filter((e) => {
        return files.includes(e.from_file.uniqueId);
      });
    };
  }

  get checklists(): (file: FileID) => ChecklistFile[] {
    return (file: FileID) => {
      return InspecDataModule.allChecklistFiles.filter(
        (e) => e.uniqueId === file
      );
    };
  }

  get selected_file_ids(): FileID[] {
    return [
      ...this.selectedEvaluationIds,
      ...this.selectedProfileIds,
      ...this.selectedChecklistIds
    ];
  }

  // check to see if all profiles are selected
  get all_profiles_selected(): Trinary {
    switch (this.selectedProfileIds.length) {
      case 0:
        return Trinary.Off;
      case InspecDataModule.allProfileFiles.length:
        return Trinary.On;
      default:
        return Trinary.Mixed;
    }
  }

  // check to see if all evaluations are selected
  get all_evaluations_selected(): Trinary {
    switch (this.selectedEvaluationIds.length) {
      case 0:
        return Trinary.Off;
      case InspecDataModule.allEvaluationFiles.length:
        return Trinary.On;
      default:
        return Trinary.Mixed;
    }
  }

  get checklist_selected(): Trinary {
    if (this.selectedChecklistIds.length === 1) return Trinary.On;
    else return Trinary.Off;
  }

  /**
   * Parameterized getter.
   * Get all controls from all profiles from the specified file id.
   * Utlizes the profiles getter to accelerate the file filter.
   */
  get controls(): (filter: Filter) => readonly ContextualizedControl[] {
    /** Cache by filter */
    const localCache: LRUCache<string, readonly ContextualizedControl[]> =
      new LRUCache(MAX_CACHE_ENTRIES);

    return (filter: Filter) => {
      // Generate a hash for cache purposes.
      // If the "searchTerm" string is not null, we don't cache - no need to pollute
      const id: string = filter_cache_key(filter);

      // Check if we have this cached:
      const cached = localCache.get(id);
      if (cached !== undefined) {
        return cached;
      }

      // Get profiles from loaded Results
      let profiles: readonly ContextualizedProfile[] =
        this.profiles_for_evaluations(filter.fromFile);

      // Get profiles from loaded Profiles
      profiles = profiles.concat(this.profiles(filter.fromFile));

      // And all the controls they contain
      let controls: readonly ContextualizedControl[] = profiles.flatMap(
        (profile) => profile.contains
      );

      // Filter by single control id
      if (filter.control_id !== undefined) {
        controls = controls.filter((c) => c.data.id === filter.control_id);
      }

      const controlFilters: Record<string, boolean | string[] | undefined> = {
        'root.hdf.severity': filter.severity,
        'hdf.wraps.id': filter.ids,
        'hdf.wraps.title': filter.titleSearchTerms,
        'hdf.wraps.desc': filter.descriptionSearchTerms,
        'hdf.rawNistTags': filter.nistIdFilter,
        full_code: filter.codeSearchTerms,
        'hdf.waived': filter.status?.includes('Waived'),
        'root.hdf.status': _.filter(
          filter.status,
          (status) => status !== 'Waived'
        )
      };

      controls = filterControlsBy(controls, controlFilters);

      // Filter by overlay
      if (filter.omit_overlayed_controls) {
        controls = controls.filter(
          (control) => control.extendedBy.length === 0
        );
      }

      // Freeform search
      if (filter.searchTerm !== undefined) {
        const term = filter.searchTerm.toLowerCase();

        // Filter controls to those that contain search term
        controls = controls.filter((c) => contains_term(c, term));
      }

      // Filter by nist stuff
      if (filter.treeFilters && filter.treeFilters.length > 0) {
        // Construct a nist control to represent the filter
        const control = new NistControl(filter.treeFilters);

        controls = controls.filter((c) => {
          // Get an hdf version so we have the fixed nist tags
          return c.root.hdf.parsedNistTags.some((t) => control.contains(t));
        });
      }

      // Freeze and save to cache
      const r = Object.freeze(controls);
      localCache.set(id, r);
      return r;
    };
  }
}

export const FilteredDataModule = getModule(FilteredData);

/**
 * Generates a unique string to represent a filter.
 * Does some minor "acceleration" techniques such as
 * - annihilating empty search terms
 * - defaulting "omit_overlayed_controls"
 */
export function filter_cache_key(f: Filter) {
  const newFilter: Filter = {
    searchTerm: f.searchTerm?.trim() || '',
    omit_overlayed_controls: f.omit_overlayed_controls || false,
    ...f
  };
  return JSON.stringify(newFilter);
}

export function filterControlsBy(
  controls: readonly ContextualizedControl[],
  filters: Record<string, boolean | string[] | undefined>
): readonly ContextualizedControl[] {
  const activeFilters: typeof filters = _.pickBy(
    filters,
    (value, _key) =>
      (Array.isArray(value) && value.length > 0) ||
      (typeof value === 'boolean' && value)
  );
  return controls.filter((control) => {
    return Object.entries(activeFilters).every(([filter, value]) => {
      const item: string | string[] | boolean = _.get(control, filter);
      if (Array.isArray(value) && typeof item !== 'boolean') {
        return value?.some((term) => {
          return arrayOrStringIncludes(item, (compareValue) =>
            compareValue.toLowerCase().includes(term.toLowerCase())
          );
        });
      } else {
        return item === value;
      }
    });
  });
}

export let passedFilterEnabled = false;
export let failedFilterEnabled = false;
export let naFilterEnabled = false;
export let nrFilterEnabled = false;

export function changeControlStatusSwitch(name: string) {
  if (name === 'Passed') {
    passedFilterEnabled = !passedFilterEnabled;
    if (passedFilterEnabled) {
      SearchModule.addStatusFilter('Passed');
    } else {
      SearchModule.removeStatusFilter('Passed');
    }
  } else if (name === 'Failed') {
    failedFilterEnabled = !failedFilterEnabled;
    if (failedFilterEnabled) {
      SearchModule.addStatusFilter('Failed');
    } else {
      SearchModule.removeStatusFilter('Failed');
    }
  } else if (name === 'Not Applicable') {
    naFilterEnabled = !naFilterEnabled;
    if (naFilterEnabled) {
      SearchModule.addStatusFilter('Not Applicable');
    } else {
      SearchModule.removeStatusFilter('Not Applicable');
    }
  } else if (name === 'Not Reviewed') {
    nrFilterEnabled = !nrFilterEnabled;
    if (nrFilterEnabled) {
      SearchModule.addStatusFilter('Not Reviewed');
    } else {
      SearchModule.removeStatusFilter('Not Reviewed');
    }
  }
}

export function filterChecklistVulnsBy(
  rules: readonly ChecklistVuln[],
  filters: Filter
): readonly ChecklistVuln[] {
  console.log('Rules: ', rules);
  console.log('Active filters: ', filters);

  // Get current filters
  let severities: string[] = [];
  let statuses: string[] = [];
  let ids: string[] = [];
  let titleSearchTerms: string[] = [];
  Object.entries(filters).forEach((elem) => {
    // Look into a more optimized way of implementing this
    if (elem[1] === undefined || elem[1].length <= 0) {
      return;
    } else if (elem[0] === 'severity') {
      severities = elem[1];
      severities.forEach(
        (elem, index, arr) => (arr[index] = elem.toLowerCase())
      );
    } else if (elem[0] === 'status') {
      statuses = elem[1];
      statuses.forEach((elem, index, arr) => {
        arr[index] = elem.toLowerCase();
      });
    } else if (elem[0] === 'ids') {
      ids = elem[1];
      ids.forEach((elem, index, arr) => (arr[index] = elem.toLowerCase()));
    } else if (elem[0] === 'titleSearchTerms') {
      titleSearchTerms = elem[1];
      titleSearchTerms.forEach(
        (elem, index, arr) => (arr[index] = elem.toLowerCase())
      );
    }
  });

  // Filter out rules
  let filteredRules = rules;
  if (severities.length > 0) {
    filteredRules = filteredRules.filter((rule) => {
      if (severities.includes(rule.severity.toLowerCase())) {
        return true;
      }
    });
  }
  if (statuses.length > 0) {
    filteredRules = filteredRules.filter((rule) => {
      if (
        rule.status != undefined &&
        statuses.includes(rule.status.toLowerCase())
      ) {
        return true;
      }
    });
  }
  if (ids.length > 0) {
    filteredRules = filteredRules.filter((rule) => {
      if (ids.includes(rule.ruleId.toLowerCase())) {
        return true;
      }
    });
  }
  if (titleSearchTerms.length > 0) {
    filteredRules = filteredRules.filter((rule) => {
      if (titleSearchTerms.includes(rule.ruleTitle.toLowerCase())) {
        return true;
      }
    });
  }
  console.log('Filtered rules: ', filteredRules);
  return filteredRules;
}

/** Iterate over a string or array of strings and call the string compare function provided on every element **/
function arrayOrStringIncludes(
  arrayOrString: string | string[],
  comparator: (compareValue: string) => boolean
) {
  if (typeof arrayOrString === 'string') {
    return comparator(arrayOrString);
  } else {
    return arrayOrString.some((value) => comparator(value));
  }
}
