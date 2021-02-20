import React, {useContext, useEffect, useState} from 'react';
import {CompositionManager} from '../CompositionManager';
import {SequenceContext} from '../sequencing';
import {RemotionAudioProps} from './props';

export const AudioForRendering: React.FC<RemotionAudioProps> = (props) => {
	const [id] = useState(() => String(Math.random()));
	const {registerAsset} = useContext(CompositionManager);
	const parentSequence = useContext(SequenceContext);

	useEffect(() => {
		if (!props.src) {
			throw new Error('No src passed');
		}

		registerAsset({
			id,
			src: props.src,
			from: parentSequence?.from ?? 0,
			duration: parentSequence?.durationInFrames,
		});
	}, [props.src, id, parentSequence, registerAsset]);

	return null;
};
