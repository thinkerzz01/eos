-- Environmental Management (5014) - Cambridge O Level outline with objectives, loaded into O1 + O2.

DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O1)' AND name='Environmental Management' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Environmental Management O Level (O1) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2025-2026','5014','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2025-2026', cambridge_code='5014', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Rocks and minerals and their exploitation',0),
    (v_org,v_tpl,'2','Energy and the environment',1),
    (v_org,v_tpl,'3','Agriculture and the environment',2),
    (v_org,v_tpl,'4','Water and its management',3),
    (v_org,v_tpl,'5','Oceans and fisheries',4),
    (v_org,v_tpl,'6','Managing natural hazards',5),
    (v_org,v_tpl,'7','The atmosphere and human activities',6),
    (v_org,v_tpl,'8','Human population',7),
    (v_org,v_tpl,'9','Natural ecosystems and human activities',8);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','Formation of rocks','["describe and interpret the rock cycle", "state and explain the formation and characteristics of named igneous, sedimentary and metamorphic rocks"]'::jsonb,0),
    ('1','1.2','Extraction of rocks and minerals from the Earth','["describe the following methods of extraction of rocks and minerals from the Earth: - surface mining - subsurface mining", "discuss the factors that affect the decision to extract rocks and minerals"]'::jsonb,1),
    ('1','1.3','Impact of rock and mineral extraction','["describe and explain the environmental, economic and social impacts of rock and mineral extraction"]'::jsonb,2),
    ('1','1.4','Managing the impact of rock and mineral extraction','["describe and evaluate strategies for restoring landscapes damaged by rock and mineral extraction"]'::jsonb,3),
    ('1','1.5','Sustainable use of rocks and minerals','["define sustainable resource and sustainable development", "describe and evaluate strategies for the sustainable use of rocks and minerals Case study:", "Study the development, impact and management of a mine including land restoration after the mine has closed."]'::jsonb,4),
    ('2','2.1','Fossil fuel formation','["describe the formation of the fossil fuels: coal, oil and gas"]'::jsonb,0),
    ('2','2.2','Energy resources and the generation of electricity','["classify the following energy resources as non- renewable or renewable:", "fossil fuels, nuclear power, biofuels, geothermal power, hydro-electric power, tidal power, wave power, solar power, wind power", "describe how each of these energy resources is used to generate electricity", "describe the environmental, economic and social advantages and disadvantages of each of these energy resources"]'::jsonb,1),
    ('2','2.3','Energy demand','["describe and explain the factors affecting the demand for energy"]'::jsonb,2),
    ('2','2.4','Conservation and management of energy resources','["describe and explain strategies for the efficient management of energy resources", "research and development of new energy resources"]'::jsonb,3),
    ('2','2.5','Impact of oil pollution','["describe the causes and impacts of oil pollution on marine and coastal ecosystems"]'::jsonb,4),
    ('2','2.6','Management of oil pollution','["discuss strategies for reducing oil spills in marine and coastal ecosystems", "discuss strategies for minimising the impacts of oil spills on the marine and coastal ecosystems Case study:", "Study the impact and management of an oil pollution event."]'::jsonb,5),
    ('3','3.1','Soil composition','["describe and explain the composition of soils"]'::jsonb,0),
    ('3','3.2','Soils for plant growth','["describe soils as a medium for plant growth", "describe the differences between a sandy and clay soil"]'::jsonb,1),
    ('3','3.3','Agriculture types','["describe the different types of agriculture"]'::jsonb,2),
    ('3','3.4','Increasing agricultural yields','["describe techniques used to increase agricultural yields"]'::jsonb,3),
    ('3','3.5','Impact of agriculture','["describe and explain the impact of agricultural practices on the environment and people"]'::jsonb,4),
    ('3','3.6','Causes and impacts of soil erosion','["describe the causes of soil erosion", "describe and explain the impacts of soil erosion"]'::jsonb,5),
    ('3','3.7','Managing soil erosion','["describe and explain strategies to reduce soil erosion"]'::jsonb,6),
    ('3','3.8','Sustainable agriculture','["describe and explain strategies for sustainable agriculture Case study:", "Study an example where agriculture has had severe environmental consequences including soil erosion and strategies for the conservation of the soil."]'::jsonb,7),
    ('4','4.1','Global water distribution','["describe the distribution of the Earth''s water"]'::jsonb,0),
    ('4','4.2','The water cycle','["describe and interpret the water cycle"]'::jsonb,1),
    ('4','4.3','Water supply','["describe the sources of fresh water used by people"]'::jsonb,2),
    ('4','4.4','Water usage','["describe the different ways in which fresh water can be used"]'::jsonb,3),
    ('4','4.5','Water quality and availability','["compare the availability of safe drinking water (potable water) in different parts of the world"]'::jsonb,4),
    ('4','4.6','Multipurpose dam projects','["describe and evaluate multipurpose dam projects"]'::jsonb,5),
    ('4','4.7','Water pollution and its sources','["describe the sources of water pollution"]'::jsonb,6),
    ('4','4.8','Impact of water pollution','["describe and explain the impact of pollution of fresh water on people and on the environment"]'::jsonb,7),
    ('4','4.9','Managing pollution of fresh water','["describe and explain strategies for improving water quality"]'::jsonb,8),
    ('4','4.10','Managing water-related disease','["describe the life cycle of the malaria parasite", "describe and evaluate strategies to control malaria", "describe strategies to control cholera Case studies:", "Study the impact of a named multipurpose dam scheme.", "Study the causes, impact and management of pollution in a named body of water."]'::jsonb,9),
    ('5','5.1','Oceans as a resource','["outline the resource potential of the oceans"]'::jsonb,0),
    ('5','5.2','World fisheries','["outline the distribution of major ocean currents", "explain the distribution of major marine fish populations", "describe the El Niño Southern Oscillation (ENSO) phenomenon and its effects on fisheries along the Pacific coast of South America"]'::jsonb,1),
    ('5','5.3','Impact of exploitation of the oceans','["describe and explain the impact of exploitation of fisheries", "describe how farming of marine species reduces the exploitation of fisheries"]'::jsonb,2),
    ('5','5.4','Management of the harvesting of marine species','["describe, explain and evaluate strategies for management of the harvesting of marine species Case studies:", "Study the resource potential, exploitation, impact and management of a marine fishery.", "Study an example of farming of marine species, including the source of food, pollution from waste and impact on the natural habitat."]'::jsonb,3),
    ('6','6.1','Earthquakes and volcanoes','["describe the structure of the Earth", "describe and explain the distribution and causes of earthquakes and volcanoes", "understand magnitude and the Richter scale"]'::jsonb,0),
    ('6','6.2','Tropical cyclones','["describe and explain the distribution and causes of tropical cyclones (storms, hurricanes and typhoons)"]'::jsonb,1),
    ('6','6.3','Flooding','["describe and explain the causes of flooding"]'::jsonb,2),
    ('6','6.4','Drought','["describe and explain the causes of drought"]'::jsonb,3),
    ('6','6.5','The impacts of natural hazards','["describe and explain the impacts of natural hazards on people and the environment"]'::jsonb,4),
    ('6','6.6','Managing the impacts of natural hazards','["describe and evaluate the strategies for managing the impacts of natural hazards before, during and after an event"]'::jsonb,5),
    ('6','6.7','Opportunities presented by natural hazards','["describe and explain the opportunities presented by natural hazards to people Case studies:", "Compare and contrast the strategies for managing the impacts of tectonic events between a named more economically developed country (MEDC) and a named less economically developed country (LEDC).", "Study the strategies for managing the impacts of a tropical storm or flood or drought."]'::jsonb,6),
    ('7','7.1','The atmosphere','["describe the structure and composition of the atmosphere", "describe the natural greenhouse effect"]'::jsonb,0),
    ('7','7.2','Atmospheric pollution and its causes','["describe and explain the causes of atmospheric pollution, with reference to: - smog - acid rain - ozone layer depletion - enhanced greenhouse effect"]'::jsonb,1),
    ('7','7.3','Impact of atmospheric pollution','["describe and explain the impact of atmospheric pollution"]'::jsonb,2),
    ('7','7.4','Managing atmospheric pollution','["describe and explain the strategies used by individuals, governments and the international community to reduce the effects of atmospheric pollution Case study:", "Study the causes, impact and management of a specific example of atmospheric pollution."]'::jsonb,3),
    ('8','8.1','Human population distribution and density','["identify where people live in the world"]'::jsonb,0),
    ('8','8.2','Changes in population size','["describe and explain the growth curve of populations", "describe and explain the changes in human populations"]'::jsonb,1),
    ('8','8.3','Population structure','["describe population structure in MEDCs and LEDCs"]'::jsonb,2),
    ('8','8.4','Managing human population size','["evaluate strategies for managing human population size Case study:", "Study the strategies a named country or region has used to manage population size."]'::jsonb,3),
    ('9','9.1','Ecosystems','["define the terms ecosystem, population, community, habitat and niche", "describe the biotic (living) and abiotic (non- living) components of an ecosystem", "describe biotic interactions", "describe the process of photosynthesis", "describe energy flow using food chains, food webs and trophic levels", "describe and explain ecological pyramids based on numbers and energy", "describe the process of respiration", "describe the carbon cycle"]'::jsonb,0),
    ('9','9.2','Ecosystems under threat','["describe and explain causes and impacts of habitat loss"]'::jsonb,1),
    ('9','9.3','Deforestation','["describe and explain the causes and impacts of deforestation"]'::jsonb,2),
    ('9','9.4','Managing forests','["describe and explain the need for the sustainable management of forests"]'::jsonb,3),
    ('9','9.5','Measuring and managing biodiversity','["describe and evaluate methods for estimating biodiversity", "apply sampling techniques to unfamiliar situations", "evaluate national and international strategies for conserving the biodiversity and genetic resources of natural ecosystems Case studies:", "Study the causes and impacts of deforestation in a named area.", "Study the conservation of a named species.", "Study a named biosphere reserve. Gathering of data", "formulate aims and hypotheses", "design questionnaires that can be oral or written to gain information from an individual or a group of individuals (consideration should be given to factors influencing the successful design of questionnaires, e.g. layout, format of questions, the appropriate wording of questions and the number of questions. The practical considerations of conducting a questionnaire, e.g. the sampling methods, pilot survey and location of survey should also be discussed)", "design a simple experiment using suitable controls", "understand and evaluate random and systematic sampling techniques. Mathematical requirements Calculators may be used in all parts of the examination.", "add, subtract, multiply and divide", "use averages, decimals, fractions, percentages, ratios and reciprocals", "understand the terms mean and range", "use standard notation, including both positive and negative indices", "understand significant figures and use them appropriately", "recognise and use direct and inverse proportion", "draw tables, charts and graphs from given data", "interpret charts and graphs", "determine the gradient and intercept of a graph", "select suitable scales and axes for graphs", "make approximate evaluations of numerical expressions", "understand the meaning of angle, curve, circle, radius, diameter, area, circumference, square, rectangle and diagonal", "understand map scale and the use of the scale line."]'::jsonb,4)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Environmental Management O Level (O1)';
END $$;


DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O2)' AND name='Environmental Management' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Environmental Management O Level (O2) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2025-2026','5014','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2025-2026', cambridge_code='5014', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Rocks and minerals and their exploitation',0),
    (v_org,v_tpl,'2','Energy and the environment',1),
    (v_org,v_tpl,'3','Agriculture and the environment',2),
    (v_org,v_tpl,'4','Water and its management',3),
    (v_org,v_tpl,'5','Oceans and fisheries',4),
    (v_org,v_tpl,'6','Managing natural hazards',5),
    (v_org,v_tpl,'7','The atmosphere and human activities',6),
    (v_org,v_tpl,'8','Human population',7),
    (v_org,v_tpl,'9','Natural ecosystems and human activities',8);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','Formation of rocks','["describe and interpret the rock cycle", "state and explain the formation and characteristics of named igneous, sedimentary and metamorphic rocks"]'::jsonb,0),
    ('1','1.2','Extraction of rocks and minerals from the Earth','["describe the following methods of extraction of rocks and minerals from the Earth: - surface mining - subsurface mining", "discuss the factors that affect the decision to extract rocks and minerals"]'::jsonb,1),
    ('1','1.3','Impact of rock and mineral extraction','["describe and explain the environmental, economic and social impacts of rock and mineral extraction"]'::jsonb,2),
    ('1','1.4','Managing the impact of rock and mineral extraction','["describe and evaluate strategies for restoring landscapes damaged by rock and mineral extraction"]'::jsonb,3),
    ('1','1.5','Sustainable use of rocks and minerals','["define sustainable resource and sustainable development", "describe and evaluate strategies for the sustainable use of rocks and minerals Case study:", "Study the development, impact and management of a mine including land restoration after the mine has closed."]'::jsonb,4),
    ('2','2.1','Fossil fuel formation','["describe the formation of the fossil fuels: coal, oil and gas"]'::jsonb,0),
    ('2','2.2','Energy resources and the generation of electricity','["classify the following energy resources as non- renewable or renewable:", "fossil fuels, nuclear power, biofuels, geothermal power, hydro-electric power, tidal power, wave power, solar power, wind power", "describe how each of these energy resources is used to generate electricity", "describe the environmental, economic and social advantages and disadvantages of each of these energy resources"]'::jsonb,1),
    ('2','2.3','Energy demand','["describe and explain the factors affecting the demand for energy"]'::jsonb,2),
    ('2','2.4','Conservation and management of energy resources','["describe and explain strategies for the efficient management of energy resources", "research and development of new energy resources"]'::jsonb,3),
    ('2','2.5','Impact of oil pollution','["describe the causes and impacts of oil pollution on marine and coastal ecosystems"]'::jsonb,4),
    ('2','2.6','Management of oil pollution','["discuss strategies for reducing oil spills in marine and coastal ecosystems", "discuss strategies for minimising the impacts of oil spills on the marine and coastal ecosystems Case study:", "Study the impact and management of an oil pollution event."]'::jsonb,5),
    ('3','3.1','Soil composition','["describe and explain the composition of soils"]'::jsonb,0),
    ('3','3.2','Soils for plant growth','["describe soils as a medium for plant growth", "describe the differences between a sandy and clay soil"]'::jsonb,1),
    ('3','3.3','Agriculture types','["describe the different types of agriculture"]'::jsonb,2),
    ('3','3.4','Increasing agricultural yields','["describe techniques used to increase agricultural yields"]'::jsonb,3),
    ('3','3.5','Impact of agriculture','["describe and explain the impact of agricultural practices on the environment and people"]'::jsonb,4),
    ('3','3.6','Causes and impacts of soil erosion','["describe the causes of soil erosion", "describe and explain the impacts of soil erosion"]'::jsonb,5),
    ('3','3.7','Managing soil erosion','["describe and explain strategies to reduce soil erosion"]'::jsonb,6),
    ('3','3.8','Sustainable agriculture','["describe and explain strategies for sustainable agriculture Case study:", "Study an example where agriculture has had severe environmental consequences including soil erosion and strategies for the conservation of the soil."]'::jsonb,7),
    ('4','4.1','Global water distribution','["describe the distribution of the Earth''s water"]'::jsonb,0),
    ('4','4.2','The water cycle','["describe and interpret the water cycle"]'::jsonb,1),
    ('4','4.3','Water supply','["describe the sources of fresh water used by people"]'::jsonb,2),
    ('4','4.4','Water usage','["describe the different ways in which fresh water can be used"]'::jsonb,3),
    ('4','4.5','Water quality and availability','["compare the availability of safe drinking water (potable water) in different parts of the world"]'::jsonb,4),
    ('4','4.6','Multipurpose dam projects','["describe and evaluate multipurpose dam projects"]'::jsonb,5),
    ('4','4.7','Water pollution and its sources','["describe the sources of water pollution"]'::jsonb,6),
    ('4','4.8','Impact of water pollution','["describe and explain the impact of pollution of fresh water on people and on the environment"]'::jsonb,7),
    ('4','4.9','Managing pollution of fresh water','["describe and explain strategies for improving water quality"]'::jsonb,8),
    ('4','4.10','Managing water-related disease','["describe the life cycle of the malaria parasite", "describe and evaluate strategies to control malaria", "describe strategies to control cholera Case studies:", "Study the impact of a named multipurpose dam scheme.", "Study the causes, impact and management of pollution in a named body of water."]'::jsonb,9),
    ('5','5.1','Oceans as a resource','["outline the resource potential of the oceans"]'::jsonb,0),
    ('5','5.2','World fisheries','["outline the distribution of major ocean currents", "explain the distribution of major marine fish populations", "describe the El Niño Southern Oscillation (ENSO) phenomenon and its effects on fisheries along the Pacific coast of South America"]'::jsonb,1),
    ('5','5.3','Impact of exploitation of the oceans','["describe and explain the impact of exploitation of fisheries", "describe how farming of marine species reduces the exploitation of fisheries"]'::jsonb,2),
    ('5','5.4','Management of the harvesting of marine species','["describe, explain and evaluate strategies for management of the harvesting of marine species Case studies:", "Study the resource potential, exploitation, impact and management of a marine fishery.", "Study an example of farming of marine species, including the source of food, pollution from waste and impact on the natural habitat."]'::jsonb,3),
    ('6','6.1','Earthquakes and volcanoes','["describe the structure of the Earth", "describe and explain the distribution and causes of earthquakes and volcanoes", "understand magnitude and the Richter scale"]'::jsonb,0),
    ('6','6.2','Tropical cyclones','["describe and explain the distribution and causes of tropical cyclones (storms, hurricanes and typhoons)"]'::jsonb,1),
    ('6','6.3','Flooding','["describe and explain the causes of flooding"]'::jsonb,2),
    ('6','6.4','Drought','["describe and explain the causes of drought"]'::jsonb,3),
    ('6','6.5','The impacts of natural hazards','["describe and explain the impacts of natural hazards on people and the environment"]'::jsonb,4),
    ('6','6.6','Managing the impacts of natural hazards','["describe and evaluate the strategies for managing the impacts of natural hazards before, during and after an event"]'::jsonb,5),
    ('6','6.7','Opportunities presented by natural hazards','["describe and explain the opportunities presented by natural hazards to people Case studies:", "Compare and contrast the strategies for managing the impacts of tectonic events between a named more economically developed country (MEDC) and a named less economically developed country (LEDC).", "Study the strategies for managing the impacts of a tropical storm or flood or drought."]'::jsonb,6),
    ('7','7.1','The atmosphere','["describe the structure and composition of the atmosphere", "describe the natural greenhouse effect"]'::jsonb,0),
    ('7','7.2','Atmospheric pollution and its causes','["describe and explain the causes of atmospheric pollution, with reference to: - smog - acid rain - ozone layer depletion - enhanced greenhouse effect"]'::jsonb,1),
    ('7','7.3','Impact of atmospheric pollution','["describe and explain the impact of atmospheric pollution"]'::jsonb,2),
    ('7','7.4','Managing atmospheric pollution','["describe and explain the strategies used by individuals, governments and the international community to reduce the effects of atmospheric pollution Case study:", "Study the causes, impact and management of a specific example of atmospheric pollution."]'::jsonb,3),
    ('8','8.1','Human population distribution and density','["identify where people live in the world"]'::jsonb,0),
    ('8','8.2','Changes in population size','["describe and explain the growth curve of populations", "describe and explain the changes in human populations"]'::jsonb,1),
    ('8','8.3','Population structure','["describe population structure in MEDCs and LEDCs"]'::jsonb,2),
    ('8','8.4','Managing human population size','["evaluate strategies for managing human population size Case study:", "Study the strategies a named country or region has used to manage population size."]'::jsonb,3),
    ('9','9.1','Ecosystems','["define the terms ecosystem, population, community, habitat and niche", "describe the biotic (living) and abiotic (non- living) components of an ecosystem", "describe biotic interactions", "describe the process of photosynthesis", "describe energy flow using food chains, food webs and trophic levels", "describe and explain ecological pyramids based on numbers and energy", "describe the process of respiration", "describe the carbon cycle"]'::jsonb,0),
    ('9','9.2','Ecosystems under threat','["describe and explain causes and impacts of habitat loss"]'::jsonb,1),
    ('9','9.3','Deforestation','["describe and explain the causes and impacts of deforestation"]'::jsonb,2),
    ('9','9.4','Managing forests','["describe and explain the need for the sustainable management of forests"]'::jsonb,3),
    ('9','9.5','Measuring and managing biodiversity','["describe and evaluate methods for estimating biodiversity", "apply sampling techniques to unfamiliar situations", "evaluate national and international strategies for conserving the biodiversity and genetic resources of natural ecosystems Case studies:", "Study the causes and impacts of deforestation in a named area.", "Study the conservation of a named species.", "Study a named biosphere reserve. Gathering of data", "formulate aims and hypotheses", "design questionnaires that can be oral or written to gain information from an individual or a group of individuals (consideration should be given to factors influencing the successful design of questionnaires, e.g. layout, format of questions, the appropriate wording of questions and the number of questions. The practical considerations of conducting a questionnaire, e.g. the sampling methods, pilot survey and location of survey should also be discussed)", "design a simple experiment using suitable controls", "understand and evaluate random and systematic sampling techniques. Mathematical requirements Calculators may be used in all parts of the examination.", "add, subtract, multiply and divide", "use averages, decimals, fractions, percentages, ratios and reciprocals", "understand the terms mean and range", "use standard notation, including both positive and negative indices", "understand significant figures and use them appropriately", "recognise and use direct and inverse proportion", "draw tables, charts and graphs from given data", "interpret charts and graphs", "determine the gradient and intercept of a graph", "select suitable scales and axes for graphs", "make approximate evaluations of numerical expressions", "understand the meaning of angle, curve, circle, radius, diameter, area, circumference, square, rectangle and diagonal", "understand map scale and the use of the scale line."]'::jsonb,4)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Environmental Management O Level (O2)';
END $$;
