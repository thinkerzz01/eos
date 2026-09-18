-- Mathematics (4024) - Cambridge O Level outline with objectives, loaded into O1 + O2.

DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O1)' AND name='Mathematics' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Mathematics O Level (O1) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2025-2027','4024','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2025-2027', cambridge_code='4024', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Number',0),
    (v_org,v_tpl,'2','Algebra and graphs',1),
    (v_org,v_tpl,'3','Coordinate geometry',2),
    (v_org,v_tpl,'4','Geometry',3),
    (v_org,v_tpl,'5','Mensuration',4),
    (v_org,v_tpl,'6','Trigonometry',5),
    (v_org,v_tpl,'7','Transformations and vectors',6),
    (v_org,v_tpl,'8','Probability',7),
    (v_org,v_tpl,'9','Statistics',8);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','Types of number','["Identify and use:", "natural numbers", "integers (positive, zero and negative)", "prime numbers", "square numbers", "cube numbers", "common factors", "common multiples", "rational and irrational numbers", "reciprocals."]'::jsonb,0),
    ('1','1.2','Sets','["Understand and use set language, notation and Venn diagrams to describe sets and represent relationships between sets."]'::jsonb,1),
    ('1','1.3','Powers and roots','["Calculate with the following:", "squares", "square roots", "cubes", "cube roots", "other powers and roots of numbers."]'::jsonb,2),
    ('1','1.4','Fractions, decimals and percentages','["1 Use the language and notation of the following in appropriate contexts:", "proper fractions", "improper fractions", "mixed numbers", "decimals", "percentages. 2 Recognise equivalence and convert between these forms."]'::jsonb,3),
    ('1','1.5','Ordering','["familiarity with the symbols =, ≠, >, < , ⩾ and ⩽. Order quantities by magnitude and demonstrate"]'::jsonb,4),
    ('1','1.6','The four operations','["Use the four operations for calculations with integers, fractions and decimals, including correct ordering of operations and use of brackets."]'::jsonb,5),
    ('1','1.7','Indices I','["1 Understand and use indices (positive, zero, negative and fractional).", "2 Understand and use the rules of indices."]'::jsonb,6),
    ('1','1.8','Standard form','["positive or negative integer and 1 ⩽ A < 10. 1 Use the standard form A × 10n where n is a", "2 Convert numbers into and out of standard form.", "3 Calculate with values in standard form."]'::jsonb,7),
    ('1','1.9','Estimation','["1 Round values to a specified degree of accuracy.", "2 Make estimates for calculations involving numbers, quantities and measurements.", "3 Round answers to a reasonable degree of accuracy in the context of a given problem."]'::jsonb,8),
    ('1','1.10','Limits of accuracy','["1 Give upper and lower bounds for data rounded to a specified accuracy.", "2 Find upper and lower bounds of the results of calculations which have used data rounded to a specified accuracy."]'::jsonb,9),
    ('1','1.11','Ratio and proportion','["Understand and use ratio and proportion to:", "give ratios in their simplest form", "divide a quantity in a given ratio", "use proportional reasoning and ratios in context."]'::jsonb,10),
    ('1','1.12','Rates','["1 Use common measures of rate.", "2 Apply other measures of rate.", "3 Solve problems involving average speed."]'::jsonb,11),
    ('1','1.13','Percentages','["1 Calculate a given percentage of a quantity.", "2 Express one quantity as a percentage of another.", "3 Calculate percentage increase or decrease.", "4 Calculate with simple and compound interest.", "5 Calculate using reverse percentages."]'::jsonb,12),
    ('1','1.14','Using a calculator','["1 Use a calculator efficiently.", "2 Enter values appropriately on a calculator.", "3 Interpret the calculator display appropriately."]'::jsonb,13),
    ('1','1.15','Time','["1 Calculate with time: seconds (s), minutes (min), hours (h), days, weeks, months, years, including the relationship between units.", "2 Calculate times in terms of the 24-hour and 12-hour clock.", "3 Read clocks and timetables."]'::jsonb,14),
    ('1','1.16','Money','["1 Calculate with money.", "2 Convert from one currency to another."]'::jsonb,15),
    ('1','1.17','Exponential growth and decay','["Use exponential growth and decay."]'::jsonb,16),
    ('1','1.18','Surds','["1 Understand and use surds, including simplifying expressions.", "2 Rationalise the denominator."]'::jsonb,17),
    ('2','2.1','Introduction to algebra','["1 Know that letters can be used to represent generalised numbers.", "2 Substitute numbers into expressions and formulas."]'::jsonb,0),
    ('2','2.2','Algebraic manipulation','["1 Simplify expressions by collecting like terms.", "2 Expand products of algebraic expressions.", "3 Factorise by extracting common factors.", "4 Factorise expressions of the form: ax + bx + kay + kby", "a2x2 − b2y2", "a2 + 2ab + b2", "ax2 + bx + c", "ax3 + bx2 + cx .", "5 Complete the square for expressions in the form ax2 + bx + c ."]'::jsonb,1),
    ('2','2.3','Algebraic fractions','["1 Manipulate algebraic fractions.", "2 Factorise and simplify rational expressions."]'::jsonb,2),
    ('2','2.4','Indices II','["1 Understand and use indices (positive, zero, negative and fractional).", "2 Understand and use the rules of indices."]'::jsonb,3),
    ('2','2.5','Equations','["1 Construct expressions, equations and formulas.", "2 Solve linear equations in one unknown.", "3 Solve fractional equations with numerical and linear algebraic denominators.", "4 Solve simultaneous linear equations in two unknowns.", "5 Solve quadratic equations by factorisation, completing the square and by use of the quadratic formula.", "6 Change the subject of formulas."]'::jsonb,4),
    ('2','2.6','Inequalities','["1 Represent and interpret inequalities, including on a number line.", "2 Construct, solve and interpret linear inequalities.", "3 Represent and interpret linear inequalities in two variables graphically.", "4 List inequalities that define a given region."]'::jsonb,5),
    ('2','2.7','Sequences','["1 Continue a given number sequence or pattern.", "2 Recognise patterns in sequences, including the term-to-term rule, and relationships between different sequences. 3 Find and use the nth term of sequences."]'::jsonb,6),
    ('2','2.8','Proportion','["Express direct and inverse proportion in algebraic terms and use this form of expression to find unknown quantities."]'::jsonb,7),
    ('2','2.9','Graphs in practical situations','["1 Use and interpret graphs in practical situations including travel graphs and conversion graphs.", "2 Draw graphs from given data.", "3 Apply the idea of rate of change to simple kinematics involving distance-time and speed-time graphs, acceleration and deceleration.", "4 Calculate distance travelled as area under a speed-time graph."]'::jsonb,8),
    ('2','2.10','Graphs of functions','["1 Construct tables of values, and draw, recognise and interpret graphs for functions of the following forms: axn (includes sums of no more than three of", "these) abx + c", "1 1 , 1, 2, 3; a and c are where n = -2, -1, −, 0, 2 2 rational numbers; and b is a positive integer. 2 Solve associated equations graphically, including finding and interpreting roots by graphical methods. 3 Draw and interpret graphs representing exponential growth and decay problems. 4 Estimate gradients of curves by drawing tangents."]'::jsonb,9),
    ('2','2.11','Sketching curves','["Recognise, sketch and interpret graphs of the following functions: (a) linear (b) quadratic (c) cubic (d) reciprocal (e) exponential."]'::jsonb,10),
    ('2','2.12','Functions','["1 Understand functions, domain and range, and use function notation.", "2 Understand and find inverse functions f -1(x).", "3 Form composite functions as defined by gf(x) = g(f(x))."]'::jsonb,11),
    ('3','3.1','Coordinates','["Use and interpret Cartesian coordinates in two dimensions."]'::jsonb,0),
    ('3','3.2','Drawing linear graphs','["Draw straight-line graphs for linear equations."]'::jsonb,1),
    ('3','3.3','Gradient of linear graphs','["1 Find the gradient of a straight line.", "2 Calculate the gradient of a straight line from the coordinates of two points on it."]'::jsonb,2),
    ('3','3.4','Length and midpoint','["1 Calculate the length of a line segment.", "2 Find the coordinates of the midpoint of a line segment."]'::jsonb,3),
    ('3','3.5','Equations of linear graphs','["Interpret and obtain the equation of a straight-line graph."]'::jsonb,4),
    ('3','3.6','Parallel lines','["Find the gradient and equation of a straight line parallel to a given line."]'::jsonb,5),
    ('3','3.7','Perpendicular lines','["Find the gradient and equation of a straight line perpendicular to a given line."]'::jsonb,6),
    ('4','4.1','Geometrical terms','["1 Use and interpret the following geometrical terms:", "point", "vertex", "line", "plane", "parallel", "perpendicular", "perpendicular bisector", "bearing", "right angle", "acute, obtuse and reflex angles", "interior and exterior angles", "similar", "congruent", "scale factor. 2 Use and interpret the vocabulary of:", "triangles", "special quadrilaterals", "polygons", "nets", "solids.", "3 Use and interpret the vocabulary of a circle."]'::jsonb,0),
    ('4','4.2','Geometrical constructions','["1 Measure and draw lines and angles.", "2 Construct a triangle, given the lengths of all sides, using a ruler and pair of compasses only.", "3 Draw, use and interpret nets."]'::jsonb,1),
    ('4','4.3','Scale drawings','["1 Draw and interpret scale drawings.", "2 Use and interpret three-figure bearings."]'::jsonb,2),
    ('4','4.4','Similarity','["1 Calculate lengths of similar shapes.", "2 Use the relationships between lengths and areas of similar shapes and lengths, surface areas and volumes of similar solids.", "3 Solve problems and give simple explanations involving similarity."]'::jsonb,3),
    ('4','4.5','Symmetry','["1 Recognise line symmetry and order of rotational symmetry in two dimensions.", "2 Recognise symmetry properties of prisms, cylinders, pyramids and cones."]'::jsonb,4),
    ('4','4.6','Angles','["1 Calculate unknown angles and give simple explanations using the following geometrical properties:", "sum of angles at a point = 360°", "sum of angles at a point on a straight line = 180°", "vertically opposite angles are equal", "angle sum of a triangle = 180° and angle sum of a quadrilateral = 360°. 2 Calculate unknown angles and give geometric explanations for angles formed within parallel lines:", "corresponding angles are equal", "alternate angles are equal", "co-interior angles sum to 180° (supplementary). 3 Know and use angle properties of regular and irregular polygons."]'::jsonb,5),
    ('4','4.7','Circle theorems I','["Calculate unknown angles and give explanations using the following geometrical properties of circles:", "angle in a semicircle = 90°", "angle between tangent and radius = 90°", "angle at the centre is twice the angle at the circumference", "angles in the same segment are equal", "opposite angles of a cyclic quadrilateral sum to 180° (supplementary)", "alternate segment theorem."]'::jsonb,6),
    ('4','4.8','Circle theorems II','["Use the following symmetry properties of circles:", "equal chords are equidistant from the centre", "the perpendicular bisector of a chord passes through the centre", "tangents from an external point are equal in length."]'::jsonb,7),
    ('5','5.1','Units of measure','["Use metric units of mass, length, area, volume and capacity in practical situations and convert quantities into larger or smaller units."]'::jsonb,0),
    ('5','5.2','Area and perimeter','["Carry out calculations involving the perimeter and area of a rectangle, triangle, parallelogram and trapezium."]'::jsonb,1),
    ('5','5.3','Circles, arcs and sectors','["1 Carry out calculations involving the circumference and area of a circle.", "2 Carry out calculations involving arc length and sector area as fractions of the circumference and area of a circle."]'::jsonb,2),
    ('5','5.4','Surface area and volume','["Carry out calculations and solve problems involving the surface area and volume of a:", "cuboid", "prism", "cylinder", "sphere", "pyramid", "cone."]'::jsonb,3),
    ('5','5.5','Compound shapes and parts of shapes','["1 Carry out calculations and solve problems involving perimeters and areas of:", "compound shapes", "parts of shapes. 2 Carry out calculations and solve problems involving surface areas and volumes of:", "compound solids", "parts of solids."]'::jsonb,4),
    ('6','6.1','Pythagoras'' theorem','["Know and use Pythagoras'' theorem."]'::jsonb,0),
    ('6','6.2','Right-angled triangles','["1 Know and use the sine, cosine and tangent ratios for acute angles in calculations involving sides and angles of a right-angled triangle.", "2 Solve problems in two dimensions using Pythagoras'' theorem and trigonometry.", "3 Know that the perpendicular distance from a point to a line is the shortest distance to the line.", "4 Carry out calculations involving angles of elevation and depression."]'::jsonb,1),
    ('6','6.3','Non-right-angled triangles','["1 Use the sine and cosine rules in calculations involving lengths and angles for any triangle.", "2 Use the formula 1 ab sin C . area of triangle = 2"]'::jsonb,2),
    ('6','6.4','Pythagoras'' theorem and trigonometry','["in 3D", "Carry out calculations and solve problems in three dimensions using Pythagoras'' theorem and trigonometry, including calculating the angle between a line and a plane."]'::jsonb,3),
    ('7','7.1','Transformations','["Recognise, describe and draw the following transformations: 1 Reflection of a shape in a straight line.", "2 Rotation of a shape about a centre through multiples of 90°.", "3 Enlargement of a shape from a centre by a scale factor. J N 4 Translation of a shape by a vector x KK OO. y L P"]'::jsonb,0),
    ('7','7.2','Vectors in two dimensions','["1 Describe a translation using a vector represented J N by x KK OO, AB or a. y L P 2 Add and subtract vectors.", "3 Multiply a vector by a scalar."]'::jsonb,1),
    ('7','7.3','Magnitude of a vector','["J N Calculate the magnitude of a vector x KK OO as y L P 2 2 x y +"]'::jsonb,2),
    ('7','7.4','Vector geometry','["1 Represent vectors by directed line segments.", "2 Use position vectors.", "3 Use the sum and difference of two or more vectors to express given vectors in terms of two coplanar vectors.", "4 Use vectors to reason and to solve geometric problems."]'::jsonb,3),
    ('8','8.1','Introduction to probability','["1 Understand and use the probability scale from 0 to 1.", "2 Understand and use probability notation.", "3 Calculate the probability of a single event.", "4 Understand that the probability of an event not occurring = 1 - the probability of the event occurring."]'::jsonb,0),
    ('8','8.2','Relative and expected frequencies','["1 Understand relative frequency as an estimate of probability.", "2 Calculate expected frequencies."]'::jsonb,1),
    ('8','8.3','Probability of combined events','["Calculate the probability of combined events using, where appropriate:", "sample space diagrams", "Venn diagrams", "tree diagrams."]'::jsonb,2),
    ('9','9.1','Classifying statistical data','["Classify and tabulate statistical data."]'::jsonb,0),
    ('9','9.2','Interpreting statistical data','["1 Read, interpret and draw inferences from tables and statistical diagrams.", "2 Compare sets of data using tables, graphs and statistical measures.", "3 Appreciate restrictions on drawing conclusions from given data."]'::jsonb,1),
    ('9','9.3','Averages and measures of spread','["1 Calculate the mean, median, mode and range for individual data and distinguish between the purposes for which these are used.", "2 Calculate an estimate of the mean for grouped discrete or grouped continuous data.", "3 Identify the modal class from a grouped frequency distribution."]'::jsonb,2),
    ('9','9.4','Statistical charts and diagrams','["Draw and interpret: (a) bar charts (b) pie charts (c) pictograms (d) simple frequency distributions."]'::jsonb,3),
    ('9','9.5','Scatter diagrams','["1 Draw and interpret scatter diagrams.", "2 Understand what is meant by positive, negative and zero correlation.", "3 Draw by eye, interpret and use a straight line of best fit."]'::jsonb,4),
    ('9','9.6','Cumulative frequency diagrams','["1 Draw and interpret cumulative frequency tables and diagrams.", "2 Estimate and interpret the median, percentiles, quartiles and interquartile range from cumulative frequency diagrams."]'::jsonb,5),
    ('9','9.7','Histograms','["1 Draw and interpret histograms.", "2 Calculate with frequency density."]'::jsonb,6)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Mathematics O Level (O1)';
END $$;


DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O2)' AND name='Mathematics' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Mathematics O Level (O2) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2025-2027','4024','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2025-2027', cambridge_code='4024', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Number',0),
    (v_org,v_tpl,'2','Algebra and graphs',1),
    (v_org,v_tpl,'3','Coordinate geometry',2),
    (v_org,v_tpl,'4','Geometry',3),
    (v_org,v_tpl,'5','Mensuration',4),
    (v_org,v_tpl,'6','Trigonometry',5),
    (v_org,v_tpl,'7','Transformations and vectors',6),
    (v_org,v_tpl,'8','Probability',7),
    (v_org,v_tpl,'9','Statistics',8);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','Types of number','["Identify and use:", "natural numbers", "integers (positive, zero and negative)", "prime numbers", "square numbers", "cube numbers", "common factors", "common multiples", "rational and irrational numbers", "reciprocals."]'::jsonb,0),
    ('1','1.2','Sets','["Understand and use set language, notation and Venn diagrams to describe sets and represent relationships between sets."]'::jsonb,1),
    ('1','1.3','Powers and roots','["Calculate with the following:", "squares", "square roots", "cubes", "cube roots", "other powers and roots of numbers."]'::jsonb,2),
    ('1','1.4','Fractions, decimals and percentages','["1 Use the language and notation of the following in appropriate contexts:", "proper fractions", "improper fractions", "mixed numbers", "decimals", "percentages. 2 Recognise equivalence and convert between these forms."]'::jsonb,3),
    ('1','1.5','Ordering','["familiarity with the symbols =, ≠, >, < , ⩾ and ⩽. Order quantities by magnitude and demonstrate"]'::jsonb,4),
    ('1','1.6','The four operations','["Use the four operations for calculations with integers, fractions and decimals, including correct ordering of operations and use of brackets."]'::jsonb,5),
    ('1','1.7','Indices I','["1 Understand and use indices (positive, zero, negative and fractional).", "2 Understand and use the rules of indices."]'::jsonb,6),
    ('1','1.8','Standard form','["positive or negative integer and 1 ⩽ A < 10. 1 Use the standard form A × 10n where n is a", "2 Convert numbers into and out of standard form.", "3 Calculate with values in standard form."]'::jsonb,7),
    ('1','1.9','Estimation','["1 Round values to a specified degree of accuracy.", "2 Make estimates for calculations involving numbers, quantities and measurements.", "3 Round answers to a reasonable degree of accuracy in the context of a given problem."]'::jsonb,8),
    ('1','1.10','Limits of accuracy','["1 Give upper and lower bounds for data rounded to a specified accuracy.", "2 Find upper and lower bounds of the results of calculations which have used data rounded to a specified accuracy."]'::jsonb,9),
    ('1','1.11','Ratio and proportion','["Understand and use ratio and proportion to:", "give ratios in their simplest form", "divide a quantity in a given ratio", "use proportional reasoning and ratios in context."]'::jsonb,10),
    ('1','1.12','Rates','["1 Use common measures of rate.", "2 Apply other measures of rate.", "3 Solve problems involving average speed."]'::jsonb,11),
    ('1','1.13','Percentages','["1 Calculate a given percentage of a quantity.", "2 Express one quantity as a percentage of another.", "3 Calculate percentage increase or decrease.", "4 Calculate with simple and compound interest.", "5 Calculate using reverse percentages."]'::jsonb,12),
    ('1','1.14','Using a calculator','["1 Use a calculator efficiently.", "2 Enter values appropriately on a calculator.", "3 Interpret the calculator display appropriately."]'::jsonb,13),
    ('1','1.15','Time','["1 Calculate with time: seconds (s), minutes (min), hours (h), days, weeks, months, years, including the relationship between units.", "2 Calculate times in terms of the 24-hour and 12-hour clock.", "3 Read clocks and timetables."]'::jsonb,14),
    ('1','1.16','Money','["1 Calculate with money.", "2 Convert from one currency to another."]'::jsonb,15),
    ('1','1.17','Exponential growth and decay','["Use exponential growth and decay."]'::jsonb,16),
    ('1','1.18','Surds','["1 Understand and use surds, including simplifying expressions.", "2 Rationalise the denominator."]'::jsonb,17),
    ('2','2.1','Introduction to algebra','["1 Know that letters can be used to represent generalised numbers.", "2 Substitute numbers into expressions and formulas."]'::jsonb,0),
    ('2','2.2','Algebraic manipulation','["1 Simplify expressions by collecting like terms.", "2 Expand products of algebraic expressions.", "3 Factorise by extracting common factors.", "4 Factorise expressions of the form: ax + bx + kay + kby", "a2x2 − b2y2", "a2 + 2ab + b2", "ax2 + bx + c", "ax3 + bx2 + cx .", "5 Complete the square for expressions in the form ax2 + bx + c ."]'::jsonb,1),
    ('2','2.3','Algebraic fractions','["1 Manipulate algebraic fractions.", "2 Factorise and simplify rational expressions."]'::jsonb,2),
    ('2','2.4','Indices II','["1 Understand and use indices (positive, zero, negative and fractional).", "2 Understand and use the rules of indices."]'::jsonb,3),
    ('2','2.5','Equations','["1 Construct expressions, equations and formulas.", "2 Solve linear equations in one unknown.", "3 Solve fractional equations with numerical and linear algebraic denominators.", "4 Solve simultaneous linear equations in two unknowns.", "5 Solve quadratic equations by factorisation, completing the square and by use of the quadratic formula.", "6 Change the subject of formulas."]'::jsonb,4),
    ('2','2.6','Inequalities','["1 Represent and interpret inequalities, including on a number line.", "2 Construct, solve and interpret linear inequalities.", "3 Represent and interpret linear inequalities in two variables graphically.", "4 List inequalities that define a given region."]'::jsonb,5),
    ('2','2.7','Sequences','["1 Continue a given number sequence or pattern.", "2 Recognise patterns in sequences, including the term-to-term rule, and relationships between different sequences. 3 Find and use the nth term of sequences."]'::jsonb,6),
    ('2','2.8','Proportion','["Express direct and inverse proportion in algebraic terms and use this form of expression to find unknown quantities."]'::jsonb,7),
    ('2','2.9','Graphs in practical situations','["1 Use and interpret graphs in practical situations including travel graphs and conversion graphs.", "2 Draw graphs from given data.", "3 Apply the idea of rate of change to simple kinematics involving distance-time and speed-time graphs, acceleration and deceleration.", "4 Calculate distance travelled as area under a speed-time graph."]'::jsonb,8),
    ('2','2.10','Graphs of functions','["1 Construct tables of values, and draw, recognise and interpret graphs for functions of the following forms: axn (includes sums of no more than three of", "these) abx + c", "1 1 , 1, 2, 3; a and c are where n = -2, -1, −, 0, 2 2 rational numbers; and b is a positive integer. 2 Solve associated equations graphically, including finding and interpreting roots by graphical methods. 3 Draw and interpret graphs representing exponential growth and decay problems. 4 Estimate gradients of curves by drawing tangents."]'::jsonb,9),
    ('2','2.11','Sketching curves','["Recognise, sketch and interpret graphs of the following functions: (a) linear (b) quadratic (c) cubic (d) reciprocal (e) exponential."]'::jsonb,10),
    ('2','2.12','Functions','["1 Understand functions, domain and range, and use function notation.", "2 Understand and find inverse functions f -1(x).", "3 Form composite functions as defined by gf(x) = g(f(x))."]'::jsonb,11),
    ('3','3.1','Coordinates','["Use and interpret Cartesian coordinates in two dimensions."]'::jsonb,0),
    ('3','3.2','Drawing linear graphs','["Draw straight-line graphs for linear equations."]'::jsonb,1),
    ('3','3.3','Gradient of linear graphs','["1 Find the gradient of a straight line.", "2 Calculate the gradient of a straight line from the coordinates of two points on it."]'::jsonb,2),
    ('3','3.4','Length and midpoint','["1 Calculate the length of a line segment.", "2 Find the coordinates of the midpoint of a line segment."]'::jsonb,3),
    ('3','3.5','Equations of linear graphs','["Interpret and obtain the equation of a straight-line graph."]'::jsonb,4),
    ('3','3.6','Parallel lines','["Find the gradient and equation of a straight line parallel to a given line."]'::jsonb,5),
    ('3','3.7','Perpendicular lines','["Find the gradient and equation of a straight line perpendicular to a given line."]'::jsonb,6),
    ('4','4.1','Geometrical terms','["1 Use and interpret the following geometrical terms:", "point", "vertex", "line", "plane", "parallel", "perpendicular", "perpendicular bisector", "bearing", "right angle", "acute, obtuse and reflex angles", "interior and exterior angles", "similar", "congruent", "scale factor. 2 Use and interpret the vocabulary of:", "triangles", "special quadrilaterals", "polygons", "nets", "solids.", "3 Use and interpret the vocabulary of a circle."]'::jsonb,0),
    ('4','4.2','Geometrical constructions','["1 Measure and draw lines and angles.", "2 Construct a triangle, given the lengths of all sides, using a ruler and pair of compasses only.", "3 Draw, use and interpret nets."]'::jsonb,1),
    ('4','4.3','Scale drawings','["1 Draw and interpret scale drawings.", "2 Use and interpret three-figure bearings."]'::jsonb,2),
    ('4','4.4','Similarity','["1 Calculate lengths of similar shapes.", "2 Use the relationships between lengths and areas of similar shapes and lengths, surface areas and volumes of similar solids.", "3 Solve problems and give simple explanations involving similarity."]'::jsonb,3),
    ('4','4.5','Symmetry','["1 Recognise line symmetry and order of rotational symmetry in two dimensions.", "2 Recognise symmetry properties of prisms, cylinders, pyramids and cones."]'::jsonb,4),
    ('4','4.6','Angles','["1 Calculate unknown angles and give simple explanations using the following geometrical properties:", "sum of angles at a point = 360°", "sum of angles at a point on a straight line = 180°", "vertically opposite angles are equal", "angle sum of a triangle = 180° and angle sum of a quadrilateral = 360°. 2 Calculate unknown angles and give geometric explanations for angles formed within parallel lines:", "corresponding angles are equal", "alternate angles are equal", "co-interior angles sum to 180° (supplementary). 3 Know and use angle properties of regular and irregular polygons."]'::jsonb,5),
    ('4','4.7','Circle theorems I','["Calculate unknown angles and give explanations using the following geometrical properties of circles:", "angle in a semicircle = 90°", "angle between tangent and radius = 90°", "angle at the centre is twice the angle at the circumference", "angles in the same segment are equal", "opposite angles of a cyclic quadrilateral sum to 180° (supplementary)", "alternate segment theorem."]'::jsonb,6),
    ('4','4.8','Circle theorems II','["Use the following symmetry properties of circles:", "equal chords are equidistant from the centre", "the perpendicular bisector of a chord passes through the centre", "tangents from an external point are equal in length."]'::jsonb,7),
    ('5','5.1','Units of measure','["Use metric units of mass, length, area, volume and capacity in practical situations and convert quantities into larger or smaller units."]'::jsonb,0),
    ('5','5.2','Area and perimeter','["Carry out calculations involving the perimeter and area of a rectangle, triangle, parallelogram and trapezium."]'::jsonb,1),
    ('5','5.3','Circles, arcs and sectors','["1 Carry out calculations involving the circumference and area of a circle.", "2 Carry out calculations involving arc length and sector area as fractions of the circumference and area of a circle."]'::jsonb,2),
    ('5','5.4','Surface area and volume','["Carry out calculations and solve problems involving the surface area and volume of a:", "cuboid", "prism", "cylinder", "sphere", "pyramid", "cone."]'::jsonb,3),
    ('5','5.5','Compound shapes and parts of shapes','["1 Carry out calculations and solve problems involving perimeters and areas of:", "compound shapes", "parts of shapes. 2 Carry out calculations and solve problems involving surface areas and volumes of:", "compound solids", "parts of solids."]'::jsonb,4),
    ('6','6.1','Pythagoras'' theorem','["Know and use Pythagoras'' theorem."]'::jsonb,0),
    ('6','6.2','Right-angled triangles','["1 Know and use the sine, cosine and tangent ratios for acute angles in calculations involving sides and angles of a right-angled triangle.", "2 Solve problems in two dimensions using Pythagoras'' theorem and trigonometry.", "3 Know that the perpendicular distance from a point to a line is the shortest distance to the line.", "4 Carry out calculations involving angles of elevation and depression."]'::jsonb,1),
    ('6','6.3','Non-right-angled triangles','["1 Use the sine and cosine rules in calculations involving lengths and angles for any triangle.", "2 Use the formula 1 ab sin C . area of triangle = 2"]'::jsonb,2),
    ('6','6.4','Pythagoras'' theorem and trigonometry','["in 3D", "Carry out calculations and solve problems in three dimensions using Pythagoras'' theorem and trigonometry, including calculating the angle between a line and a plane."]'::jsonb,3),
    ('7','7.1','Transformations','["Recognise, describe and draw the following transformations: 1 Reflection of a shape in a straight line.", "2 Rotation of a shape about a centre through multiples of 90°.", "3 Enlargement of a shape from a centre by a scale factor. J N 4 Translation of a shape by a vector x KK OO. y L P"]'::jsonb,0),
    ('7','7.2','Vectors in two dimensions','["1 Describe a translation using a vector represented J N by x KK OO, AB or a. y L P 2 Add and subtract vectors.", "3 Multiply a vector by a scalar."]'::jsonb,1),
    ('7','7.3','Magnitude of a vector','["J N Calculate the magnitude of a vector x KK OO as y L P 2 2 x y +"]'::jsonb,2),
    ('7','7.4','Vector geometry','["1 Represent vectors by directed line segments.", "2 Use position vectors.", "3 Use the sum and difference of two or more vectors to express given vectors in terms of two coplanar vectors.", "4 Use vectors to reason and to solve geometric problems."]'::jsonb,3),
    ('8','8.1','Introduction to probability','["1 Understand and use the probability scale from 0 to 1.", "2 Understand and use probability notation.", "3 Calculate the probability of a single event.", "4 Understand that the probability of an event not occurring = 1 - the probability of the event occurring."]'::jsonb,0),
    ('8','8.2','Relative and expected frequencies','["1 Understand relative frequency as an estimate of probability.", "2 Calculate expected frequencies."]'::jsonb,1),
    ('8','8.3','Probability of combined events','["Calculate the probability of combined events using, where appropriate:", "sample space diagrams", "Venn diagrams", "tree diagrams."]'::jsonb,2),
    ('9','9.1','Classifying statistical data','["Classify and tabulate statistical data."]'::jsonb,0),
    ('9','9.2','Interpreting statistical data','["1 Read, interpret and draw inferences from tables and statistical diagrams.", "2 Compare sets of data using tables, graphs and statistical measures.", "3 Appreciate restrictions on drawing conclusions from given data."]'::jsonb,1),
    ('9','9.3','Averages and measures of spread','["1 Calculate the mean, median, mode and range for individual data and distinguish between the purposes for which these are used.", "2 Calculate an estimate of the mean for grouped discrete or grouped continuous data.", "3 Identify the modal class from a grouped frequency distribution."]'::jsonb,2),
    ('9','9.4','Statistical charts and diagrams','["Draw and interpret: (a) bar charts (b) pie charts (c) pictograms (d) simple frequency distributions."]'::jsonb,3),
    ('9','9.5','Scatter diagrams','["1 Draw and interpret scatter diagrams.", "2 Understand what is meant by positive, negative and zero correlation.", "3 Draw by eye, interpret and use a straight line of best fit."]'::jsonb,4),
    ('9','9.6','Cumulative frequency diagrams','["1 Draw and interpret cumulative frequency tables and diagrams.", "2 Estimate and interpret the median, percentiles, quartiles and interquartile range from cumulative frequency diagrams."]'::jsonb,5),
    ('9','9.7','Histograms','["1 Draw and interpret histograms.", "2 Calculate with frequency density."]'::jsonb,6)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Mathematics O Level (O2)';
END $$;
