import {ExecJSON} from 'inspecjs';
import _ from 'lodash';
import {version as HeimdallToolsVersion} from '../package.json';
import {
  BaseConverter,
  ILookupPath,
  impactMapping,
  MappedTransform
} from './base-converter';

export class TrufflehogMapper extends BaseConverter {
  withRaw: boolean;

  mappings: MappedTransform<
    ExecJSON.Execution & {passthrough: unknown},
    ILookupPath
  > = {
    platform: {
      name: 'Heimdall Tools',
      release: HeimdallToolsVersion,
      target_id: null  
    },
    version: HeimdallToolsVersion,
    statistics: {
      duration: null  
    },
    profiles: [
      {
        name: {path: 'SourceName'},              
        title: {path: 'SourceName'},           
        version: null,         
        maintainer: null,      
        summary: null,         
        license: null,         
        copyright: null,       
        copyright_email: null, 
        supports: [],          
        attributes: [],        
        depends: [],           
        groups: [],            
        status: 'loaded',      
        controls: [
          {
            key: 'id',
            tags: {
                nist: 'IA-5(7)',
                cci
            },             
            descriptions: [],     
            refs: [],             
            source_location: {},  
            title: {
                transformer: (data: Record<string, unknown>): string => {
                    return _.get(data, 'DetectorName') + '_' + _.get(data, 'DecoderName');
                }
            },          
            id: {
                transformer: (data: Record<string, unknown>): string => {
                    return _.get(data, 'DetectorType') + '_' + _.get(data, 'DecoderName');
                }
            },               
            desc: {
                transformer: (data: Record<string, unknown>): string => {
                    return 'Found ' + _.get(data, 'DetectorName') + ' secret using ' + _.get(data, 'DecoderName') + 'decoder'
                }
            },           
            impact: 0,            
            code: null,           
            results: [
              {
                status: ExecJSON.ControlResultStatus.Failed,  
                code_desc: '',                                
                message: {
                    transformer: (data: Record<string, unknown>): string => {
                        return _.omit(data, 'SourceMetadata');
                    }
                },                                
                run_time: null,                               
                start_time: ''                                
              }
            ]
          }
        ],
        sha256: ''
      }
    ],
    passthrough: {
      transformer: (data: Record<string, any>): Record<string, unknown> => {
        return {
          auxiliary_data: [{name: '', data: _.omit([])}],  //Insert service name and mapped fields to be removed
          ...(this.withRaw && {raw: data})
        };
      }
    }
  };
  constructor(exportJson: string, withRaw = false) {
    super(JSON.parse(exportJson), true);
    this.withRaw = withRaw
  }
}